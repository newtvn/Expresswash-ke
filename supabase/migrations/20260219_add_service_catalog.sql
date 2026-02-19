-- Service Catalog: stores descriptions and photo URLs per item type
-- Uses the existing system_config table with id='service_catalog'

-- Seed the service catalog config if it doesn't exist
INSERT INTO system_config (id, config, updated_at)
VALUES (
  'service_catalog',
  '{
    "carpet": { "description": "Deep cleaning for all carpet types and sizes. Stain removal, deodorizing, and fiber protection included.", "photoUrl": "" },
    "rug": { "description": "Gentle hand-wash and machine cleaning for delicate and heavy rugs. Color-safe process.", "photoUrl": "" },
    "curtain": { "description": "Professional curtain cleaning with pressing. We handle all fabrics including sheer and blackout.", "photoUrl": "" },
    "sofa": { "description": "Upholstery deep-clean for sofas and couches. Removes stains, pet hair, and odors.", "photoUrl": "" },
    "mattress": { "description": "Sanitization and deep cleaning for mattresses. Dust mite removal and fresh scent treatment.", "photoUrl": "" },
    "chair": { "description": "Office and dining chair cleaning. Fabric and leather options available.", "photoUrl": "" },
    "pillow": { "description": "Hypoallergenic wash for pillows and cushions. Fluff restoration included.", "photoUrl": "" },
    "other": { "description": "Custom cleaning for specialty items. Contact us for a quote.", "photoUrl": "" }
  }'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for pricing photos if it doesn't exist
-- Note: This needs to be done via Supabase Dashboard or supabase CLI, not SQL
-- INSERT INTO storage.buckets (id, name, public) VALUES ('public', 'public', true) ON CONFLICT DO NOTHING;
