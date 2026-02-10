import { useState } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  MapPin,
  Phone,
  User,
  Package,
  Camera,
  PenLine,
  Navigation,
  CheckCircle,
  Truck,
  ArrowRight,
} from 'lucide-react';

type TaskStatus = 'en_route' | 'arrived' | 'collecting' | 'collected' | 'delivering' | 'delivered';

const statusActions: Record<TaskStatus, { label: string; next: TaskStatus | null }> = {
  en_route: { label: 'Confirm Arrival', next: 'arrived' },
  arrived: { label: 'Start Collecting Items', next: 'collecting' },
  collecting: { label: 'Confirm Pickup', next: 'collected' },
  collected: { label: 'Start Delivery', next: 'delivering' },
  delivering: { label: 'Complete Delivery', next: 'delivered' },
  delivered: { label: 'Task Completed', next: null },
};

const statusLabels: Record<TaskStatus, string> = {
  en_route: 'En Route',
  arrived: 'Arrived',
  collecting: 'Collecting Items',
  collected: 'Items Collected',
  delivering: 'Out for Delivery',
  delivered: 'Delivered',
};

export const PickupDelivery = () => {
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>('en_route');
  const [notes, setNotes] = useState('');

  const task = {
    orderNumber: 'EW-2025-00420',
    type: 'pickup' as const,
    customerName: 'David Maina',
    phone: '+254 723 456 789',
    address: '8 River View Estate, Athi River',
    zone: 'Athi River',
    items: [
      { name: 'Sofa (3-Seater)', quantity: 1 },
      { name: 'Cushion Covers', quantity: 4 },
    ],
  };

  const handleAdvanceStatus = () => {
    const action = statusActions[currentStatus];
    if (action.next) {
      setCurrentStatus(action.next);
    }
  };

  const currentAction = statusActions[currentStatus];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Task"
        description={`Order #${task.orderNumber}`}
      >
        <Badge variant={task.type === 'pickup' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
          {task.type === 'pickup' ? 'Pickup' : 'Delivery'}
        </Badge>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Task Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {(Object.keys(statusLabels) as TaskStatus[]).map((status) => {
                  const isCompleted =
                    Object.keys(statusLabels).indexOf(status) <
                    Object.keys(statusLabels).indexOf(currentStatus);
                  const isCurrent = status === currentStatus;
                  return (
                    <Badge
                      key={status}
                      variant="outline"
                      className={
                        isCompleted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : isCurrent
                          ? 'bg-primary/20 text-primary border-primary'
                          : 'text-muted-foreground'
                      }
                    >
                      {isCompleted && <CheckCircle className="mr-1 h-3 w-3" />}
                      {statusLabels[status]}
                    </Badge>
                  );
                })}
              </div>

              {currentAction.next && (
                <Button className="w-full" size="lg" onClick={handleAdvanceStatus}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  {currentAction.label}
                </Button>
              )}

              {!currentAction.next && (
                <div className="text-center py-4">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="font-medium text-green-600">Task Completed Successfully</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer & Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block text-xs">Customer</span>
                      <span className="font-medium">{task.customerName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block text-xs">Phone</span>
                      <span className="font-medium">{task.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="text-muted-foreground block text-xs">Address</span>
                      <span className="font-medium">{task.address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground block text-xs">Zone</span>
                      <span className="font-medium">{task.zone}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium text-sm mb-3">Items</h4>
                <div className="space-y-2">
                  {task.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span>{item.name}</span>
                      </div>
                      <Badge variant="outline">x{item.quantity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          {/* Photo Capture */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Photo Evidence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Capture item condition</p>
                <Button variant="outline" size="sm">
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Customer Signature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <PenLine className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">Collect signature on handover</p>
                <Button variant="outline" size="sm">
                  <PenLine className="mr-2 h-4 w-4" />
                  Collect Signature
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="task-notes" className="sr-only">Notes</Label>
              <Textarea
                id="task-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this pickup/delivery..."
                rows={4}
              />
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Save Notes
              </Button>
            </CardContent>
          </Card>

          {/* Navigate Button */}
          <Button variant="outline" className="w-full">
            <Navigation className="mr-2 h-4 w-4" />
            Open in Maps
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PickupDelivery;
