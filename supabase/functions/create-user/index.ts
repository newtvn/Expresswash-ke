/**
 * Supabase Edge Function: Create User
 * Creates a new user with admin.createUser (service_role) so no confirmation email is sent.
 * Then queues a custom welcome email with login details via notification_history.
 *
 * Endpoint: POST /functions/v1/create-user
 * Auth: Requires valid Supabase auth token from admin/super_admin
 *
 * Request Body:
 * {
 *   email: string,
 *   password: string,
 *   name: string,
 *   phone?: string,
 *   role: 'driver' | 'customer' | 'warehouse_staff',
 *   zone?: string,
 *   driverDetails?: { vehiclePlate, vehicleType, licenseNumber }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check caller is admin
    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role, name')
      .eq('id', caller.id)
      .single();

    if (!callerProfile || !['admin', 'super_admin'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body = await req.json();
    const { email, password, name, phone, role, zone, driverDetails } = body;

    if (!email || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'email, password, name, and role are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service_role client to create user (bypasses email confirmation)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role, zone },
    });

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: authError?.message ?? 'Failed to create user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = authData.user.id;

    // Explicitly upsert the profile so the correct role/zone is always set,
    // regardless of whether the on_auth_user_created trigger runs or reads metadata correctly.
    const { error: profileError } = await adminClient.from('profiles').upsert({
      id: userId,
      name,
      email,
      phone: phone || '',
      role,
      zone: zone || '',
      is_active: true,
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile upsert failed:', profileError.message);
    }

    // If driver, insert into drivers table
    if (role === 'driver') {
      const { error: driverError } = await adminClient.from('drivers').upsert({
        id: userId,
        zone: zone || '',
        vehicle_plate: driverDetails?.vehiclePlate || '',
        vehicle_type: driverDetails?.vehicleType || '',
        license_number: driverDetails?.licenseNumber || '',
        status: 'offline',
        is_online: false,
        rating: 0,
        total_deliveries: 0,
      }, { onConflict: 'id' });

      if (driverError) {
        console.error('Driver record upsert failed:', driverError.message);
      }
    }

    // Queue welcome email
    const welcomeSubject = role === 'driver'
      ? `Welcome to ExpressWash, ${name}! Your driver account is ready`
      : `Welcome to ExpressWash, ${name}!`;

    const vehicleInfo = driverDetails
      ? `<p style="margin:4px 0"><strong>Vehicle:</strong> ${driverDetails.vehicleType} - ${driverDetails.vehiclePlate}</p>`
      : '';
    const zoneInfo = zone ? `<p style="margin:4px 0"><strong>Zone:</strong> ${zone}</p>` : '';

    await adminClient.from('notification_history').insert({
      template_name: 'User Welcome',
      channel: 'email',
      recipient_id: userId,
      recipient_name: name,
      recipient_contact: email,
      subject: welcomeSubject,
      body: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#2563eb">Welcome to ExpressWash!</h2>
<p>Hi ${name},</p>
<p>Your ${role.replace('_', ' ')} account has been created on the ExpressWash platform. Here are your login details:</p>
<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0">
<p style="margin:4px 0"><strong>Email:</strong> ${email}</p>
<p style="margin:4px 0"><strong>Password:</strong> ${password}</p>
${zoneInfo}${vehicleInfo}
</div>
<p>Please log in and change your password as soon as possible.</p>
<a href="https://expresswash.co.ke/login" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:8px 0">Log In Now</a>
<p style="color:#64748b;font-size:12px;margin-top:24px">ExpressWash Kenya - Professional Carpet & Fabric Cleaning</p>
</div>`,
      status: 'pending',
    });

    // Audit log
    await adminClient.from('audit_logs').insert({
      user_id: caller.id,
      user_name: callerProfile.name,
      user_role: callerProfile.role,
      action: 'CREATE',
      entity: role === 'driver' ? 'driver' : 'user',
      entity_id: userId,
      details: JSON.stringify({ name, email, role, zone, ...(driverDetails || {}) }),
      ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      success: true,
      userId,
      message: `${role} created successfully`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('create-user error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
