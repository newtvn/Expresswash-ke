import { useState } from 'react';
import { PageHeader, StatusBadge } from '@/components/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Droplets,
  Wind,
  CheckCircle,
  Clock,
  Play,
  ArrowRight,
  Timer,
  User,
} from 'lucide-react';

interface ProcessingItem {
  id: string;
  orderNumber: string;
  item: string;
  type: string;
  stage: 'queue' | 'washing' | 'drying' | 'ready';
  startTime: string;
  assignedTo: string;
  elapsed?: string;
}

const mockItems: ProcessingItem[] = [
  // In Queue
  { id: '1', orderNumber: 'EW-2025-00430', item: 'Office Rug', type: 'Rug', stage: 'queue', startTime: '---', assignedTo: '---' },
  { id: '2', orderNumber: 'EW-2025-00425', item: 'Pillow (Set of 4)', type: 'Pillow', stage: 'queue', startTime: '---', assignedTo: '---' },
  { id: '3', orderNumber: 'EW-2025-00420', item: 'Curtain Pair (Short)', type: 'Curtain', stage: 'queue', startTime: '---', assignedTo: '---' },
  // Washing
  { id: '4', orderNumber: 'EW-2025-00412', item: 'Living Room Carpet', type: 'Carpet', stage: 'washing', startTime: '08:30 AM', assignedTo: 'Samuel Kibet', elapsed: '2h 45m' },
  { id: '5', orderNumber: 'EW-2025-00412', item: 'Persian Rug', type: 'Rug', stage: 'washing', startTime: '08:45 AM', assignedTo: 'Samuel Kibet', elapsed: '2h 30m' },
  { id: '6', orderNumber: 'EW-2025-00408', item: 'Sofa (3-Seater)', type: 'Sofa', stage: 'washing', startTime: '09:15 AM', assignedTo: 'Joseph Wekesa', elapsed: '2h 00m' },
  // Drying
  { id: '7', orderNumber: 'EW-2025-00415', item: 'Carpet (Medium)', type: 'Carpet', stage: 'drying', startTime: '07:00 AM', assignedTo: 'Samuel Kibet', elapsed: '4h 15m' },
  { id: '8', orderNumber: 'EW-2025-00415', item: 'Carpet (Small)', type: 'Carpet', stage: 'drying', startTime: '07:30 AM', assignedTo: 'Joseph Wekesa', elapsed: '3h 45m' },
  { id: '9', orderNumber: 'EW-2025-00420', item: 'Curtain Pair (Long)', type: 'Curtain', stage: 'drying', startTime: '06:45 AM', assignedTo: 'Samuel Kibet', elapsed: '4h 30m' },
  // Ready
  { id: '10', orderNumber: 'EW-2025-00395', item: 'Curtain Pair (1)', type: 'Curtain', stage: 'ready', startTime: 'Completed', assignedTo: 'Joseph Wekesa' },
  { id: '11', orderNumber: 'EW-2025-00395', item: 'Curtain Pair (2)', type: 'Curtain', stage: 'ready', startTime: 'Completed', assignedTo: 'Joseph Wekesa' },
  { id: '12', orderNumber: 'EW-2025-00395', item: 'Curtain Pair (3)', type: 'Curtain', stage: 'ready', startTime: 'Completed', assignedTo: 'Samuel Kibet' },
];

const stageCounts = {
  queue: mockItems.filter((i) => i.stage === 'queue').length,
  washing: mockItems.filter((i) => i.stage === 'washing').length,
  drying: mockItems.filter((i) => i.stage === 'drying').length,
  ready: mockItems.filter((i) => i.stage === 'ready').length,
};

function ProcessingTable({ items, stage }: { items: ProcessingItem[]; stage: string }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Order #</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>{stage === 'queue' ? 'Queued' : 'Start Time'}</TableHead>
            <TableHead>Assigned To</TableHead>
            {(stage === 'washing' || stage === 'drying') && <TableHead>Elapsed</TableHead>}
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No items in this stage
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.orderNumber}</TableCell>
                <TableCell>{item.item}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.type}</Badge>
                </TableCell>
                <TableCell>{item.startTime}</TableCell>
                <TableCell>
                  {item.assignedTo !== '---' ? (
                    <div className="flex items-center gap-1 text-sm">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {item.assignedTo}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">---</span>
                  )}
                </TableCell>
                {(stage === 'washing' || stage === 'drying') && (
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Timer className="h-3 w-3 text-orange-500" />
                      <span className="font-medium">{item.elapsed}</span>
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {stage === 'queue' && (
                    <Button size="sm">
                      <Play className="mr-1 h-3 w-3" />
                      Start
                    </Button>
                  )}
                  {(stage === 'washing' || stage === 'drying') && (
                    <Button size="sm" variant="outline">
                      <ArrowRight className="mr-1 h-3 w-3" />
                      Complete
                    </Button>
                  )}
                  {stage === 'ready' && (
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Done
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export const Processing = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Processing" description="Track items through washing and drying stages" />

      {/* Stage Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-4 text-center">
            <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-yellow-800">{stageCounts.queue}</p>
            <p className="text-xs text-yellow-600">In Queue</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4 text-center">
            <Droplets className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-blue-800">{stageCounts.washing}</p>
            <p className="text-xs text-blue-600">Washing</p>
          </CardContent>
        </Card>
        <Card className="bg-sky-50 border-sky-200">
          <CardContent className="py-4 text-center">
            <Wind className="h-6 w-6 text-sky-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-sky-800">{stageCounts.drying}</p>
            <p className="text-xs text-sky-600">Drying</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="py-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-800">{stageCounts.ready}</p>
            <p className="text-xs text-green-600">Ready</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="queue">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="queue">In Queue ({stageCounts.queue})</TabsTrigger>
          <TabsTrigger value="washing">Washing ({stageCounts.washing})</TabsTrigger>
          <TabsTrigger value="drying">Drying ({stageCounts.drying})</TabsTrigger>
          <TabsTrigger value="ready">Ready ({stageCounts.ready})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <ProcessingTable items={mockItems.filter((i) => i.stage === 'queue')} stage="queue" />
        </TabsContent>
        <TabsContent value="washing" className="mt-4">
          <ProcessingTable items={mockItems.filter((i) => i.stage === 'washing')} stage="washing" />
        </TabsContent>
        <TabsContent value="drying" className="mt-4">
          <ProcessingTable items={mockItems.filter((i) => i.stage === 'drying')} stage="drying" />
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          <ProcessingTable items={mockItems.filter((i) => i.stage === 'ready')} stage="ready" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Processing;
