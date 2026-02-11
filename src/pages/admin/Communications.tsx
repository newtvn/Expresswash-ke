import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Send, Bell, History, CheckCircle, XCircle } from 'lucide-react';
import {
  getTemplates,
  sendNotification,
  getNotificationHistory,
  NotificationHistoryEntry,
} from '@/services/communicationService';

export const Communications = () => {
  const qc = useQueryClient();
  const [sendForm, setSendForm] = useState({
    templateId: '',
    recipientId: '',
    recipientName: '',
    recipientContact: '',
    variables: {} as Record<string, string>,
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['comm', 'templates'],
    queryFn: getTemplates,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['comm', 'history'],
    queryFn: () => getNotificationHistory(),
  });

  const selectedTemplate = templates.find((t) => t.id === sendForm.templateId);

  const sendMutation = useMutation({
    mutationFn: () =>
      sendNotification({
        templateId: sendForm.templateId,
        recipientId: sendForm.recipientId,
        recipientName: sendForm.recipientName,
        recipientContact: sendForm.recipientContact,
        variables: sendForm.variables,
      }),
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Notification sent successfully');
        setSendForm({ templateId: '', recipientId: '', recipientName: '', recipientContact: '', variables: {} });
        qc.invalidateQueries({ queryKey: ['comm', 'history'] });
      } else {
        toast.error(data.error ?? 'Failed to send notification');
      }
    },
  });

  const statusColor = (status: NotificationHistoryEntry['status']) => {
    if (status === 'delivered') return 'bg-green-100 text-green-800';
    if (status === 'sent') return 'bg-blue-100 text-blue-800';
    if (status === 'failed') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Communications" description="Manage notification templates and send messages" />

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates"><Bell className="w-4 h-4 mr-2" />Templates</TabsTrigger>
          <TabsTrigger value="send"><Send className="w-4 h-4 mr-2" />Send Notification</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          {templatesLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((t) => (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">{t.channel}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground line-clamp-2">{t.body}</p>
                    {t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.variables.map((v) => (
                          <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          <Card className="max-w-xl">
            <CardHeader><CardTitle>Send Notification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template</Label>
                <Select value={sendForm.templateId} onValueChange={(v) => setSendForm({ ...sendForm, templateId: v, variables: {} })}>
                  <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.channel})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Recipient Name</Label><Input value={sendForm.recipientName} onChange={(e) => setSendForm({ ...sendForm, recipientName: e.target.value })} placeholder="Customer name" /></div>
              <div><Label>Recipient Contact</Label><Input value={sendForm.recipientContact} onChange={(e) => setSendForm({ ...sendForm, recipientContact: e.target.value })} placeholder="+254 7XX or email" /></div>
              <div><Label>Recipient ID (user UUID)</Label><Input value={sendForm.recipientId} onChange={(e) => setSendForm({ ...sendForm, recipientId: e.target.value })} placeholder="UUID" /></div>

              {selectedTemplate && selectedTemplate.variables.length > 0 && (
                <div className="space-y-3 border-t pt-3">
                  <p className="text-sm font-medium">Template Variables</p>
                  {selectedTemplate.variables.map((v) => (
                    <div key={v}>
                      <Label>{v}</Label>
                      <Input
                        value={sendForm.variables[v] ?? ''}
                        onChange={(e) => setSendForm({ ...sendForm, variables: { ...sendForm.variables, [v]: e.target.value } })}
                        placeholder={`Value for {{${v}}}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              <Button
                className="w-full"
                disabled={!sendForm.templateId || !sendForm.recipientContact || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                <Send className="w-4 h-4 mr-2" />
                {sendMutation.isPending ? 'Sending...' : 'Send Notification'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {historyLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <Card key={h.id}>
                  <CardContent className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{h.recipientName}</span>
                        <Badge variant="outline" className="text-xs">{h.channel}</Badge>
                        <Badge className={`text-xs ${statusColor(h.status)}`}>{h.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{h.body}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(h.sentAt).toLocaleString()}</p>
                    </div>
                    {h.status === 'delivered' ? (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    ) : h.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                    ) : null}
                  </CardContent>
                </Card>
              ))}
              {history.length === 0 && <p className="text-center text-muted-foreground py-12">No notifications sent yet</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Communications;
