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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Send, Bell, History, CheckCircle, XCircle, Eye, Search } from 'lucide-react';
import {
  getTemplates,
  sendNotification,
  getNotificationHistory,
  NotificationTemplate,
  NotificationHistoryEntry,
} from '@/services/communicationService';
import { sanitizeHTML } from '@/utils/validation';

const humanizeTemplateName = (name: string) => name
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const templateExcerpt = (body: string) => body
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const Communications = () => {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('templates');
  const [templateSearch, setTemplateSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
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
  const filteredTemplates = templates.filter((template) => {
    const matchesChannel = channelFilter === 'all' || template.channel === channelFilter;
    const query = templateSearch.trim().toLowerCase();
    const matchesSearch = !query
      || template.name.toLowerCase().includes(query)
      || templateExcerpt(template.body).toLowerCase().includes(query);
    return matchesChannel && matchesSearch;
  });

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates"><Bell className="w-4 h-4 mr-2" />Templates</TabsTrigger>
          <TabsTrigger value="send"><Send className="w-4 h-4 mr-2" />Send Notification</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-2" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-4">
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                placeholder="Search templates..."
                className="pl-9"
              />
            </div>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-44" aria-label="Filter by channel">
                <SelectValue placeholder="All channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="push">Push</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {templatesLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTemplates.map((t) => (
                <Card key={t.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{humanizeTemplateName(t.name)}</CardTitle>
                      <Badge variant="outline" className="text-xs capitalize">{t.channel}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {t.subject && <p className="mb-1 text-xs font-medium">{t.subject}</p>}
                    <p className="text-xs text-muted-foreground line-clamp-2">{templateExcerpt(t.body)}</p>
                    {t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.variables.map((v) => (
                          <Badge key={v} variant="secondary" className="text-xs">{`{{${v}}}`}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPreviewTemplate(t)}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSendForm((current) => ({ ...current, templateId: t.id, variables: {} }));
                          setActiveTab('send');
                        }}
                      >
                        Use template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredTemplates.length === 0 && (
                <Card className="md:col-span-2">
                  <CardContent className="py-12 text-center">
                    <p className="text-sm font-medium">No templates match these filters</p>
                    <p className="mt-1 text-xs text-muted-foreground">Try another search term or channel.</p>
                  </CardContent>
                </Card>
              )}
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

      <Dialog open={!!previewTemplate} onOpenChange={(open) => { if (!open) setPreviewTemplate(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTemplate ? humanizeTemplateName(previewTemplate.name) : 'Template preview'}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.channel ? `${previewTemplate.channel.toUpperCase()} preview` : 'Message preview'}
            </DialogDescription>
          </DialogHeader>
          {previewTemplate?.subject && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="mt-1 text-sm font-medium">{previewTemplate.subject}</p>
            </div>
          )}
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border bg-white p-5 text-sm text-slate-900">
            {previewTemplate?.channel === 'email' ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(previewTemplate.body) }} />
            ) : (
              <p className="whitespace-pre-wrap leading-6">{previewTemplate?.body}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Communications;
