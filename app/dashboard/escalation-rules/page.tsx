import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus, Edit, Trash2, Settings } from "lucide-react"

export default async function EscalationRulesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please log in</div>
  }

  // Get escalation rules
  const { data: rules } = await supabase
    .from('escalation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('priority', { ascending: false })

  // Get escalation logs for statistics
  const { data: logs } = await supabase
    .from('escalation_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const getConditionTypeLabel = (condition: any) => {
    if (condition.sentiment_score) return 'Sentiment Score'
    if (condition.keywords) return 'Keywords'
    if (condition.message_count) return 'Message Count'
    if (condition.time_elapsed) return 'Time Elapsed'
    if (condition.urgency) return 'Urgency Level'
    if (condition.channel) return 'Channel'
    return 'Unknown'
  }

  const getActionTypeLabel = (action: any) => {
    switch (action.type) {
      case 'escalate': return 'Escalate Conversation'
      case 'notify_agent': return 'Notify Agent'
      case 'notify_supervisor': return 'Notify Supervisor'
      case 'assign_agent': return 'Assign Agent'
      case 'update_priority': return 'Update Priority'
      case 'add_tags': return 'Add Tags'
      default: return 'Unknown Action'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Escalation Rules</h1>
        <p className="text-muted-foreground">Configure automatic escalation rules for customer conversations</p>
      </div>

      <div className="grid gap-6">
        {/* Rules Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Rules</CardTitle>
                <CardDescription>Manage your conversation escalation rules</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Escalation Rule</DialogTitle>
                    <DialogDescription>
                      Configure conditions and actions for automatic conversation escalation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rule-name">Rule Name</Label>
                      <Input id="rule-name" placeholder="e.g., High Negative Sentiment" />
                    </div>
                    <div>
                      <Label htmlFor="rule-description">Description</Label>
                      <Textarea id="rule-description" placeholder="Brief description of when this rule triggers" />
                    </div>
                    <div>
                      <Label>Conditions</Label>
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-3 gap-2">
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Condition Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sentiment_score">Sentiment Score</SelectItem>
                              <SelectItem value="keywords">Keywords</SelectItem>
                              <SelectItem value="message_count">Message Count</SelectItem>
                              <SelectItem value="time_elapsed">Time Elapsed</SelectItem>
                              <SelectItem value="urgency">Urgency Level</SelectItem>
                              <SelectItem value="channel">Channel</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="<">Less than</SelectItem>
                              <SelectItem value=">">Greater than</SelectItem>
                              <SelectItem value="=">Equals</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder="Value" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Actions</Label>
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Action Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="escalate">Escalate Conversation</SelectItem>
                              <SelectItem value="notify_agent">Notify Agent</SelectItem>
                              <SelectItem value="notify_supervisor">Notify Supervisor</SelectItem>
                              <SelectItem value="assign_agent">Assign Agent</SelectItem>
                              <SelectItem value="update_priority">Update Priority</SelectItem>
                              <SelectItem value="add_tags">Add Tags</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder="Action Details" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="rule-active" defaultChecked />
                      <Label htmlFor="rule-active">Active</Label>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline">Cancel</Button>
                      <Button>Create Rule</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules?.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {Object.keys(rule.conditions || {}).map((key) => (
                          <Badge key={key} variant="outline" className="mr-1 mb-1">
                            {getConditionTypeLabel({ [key]: rule.conditions[key] })}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {rule.actions?.map((action: any, index: number) => (
                          <Badge key={index} variant="secondary" className="mr-1 mb-1">
                            {getActionTypeLabel(action)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {(!rules || rules.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No escalation rules configured yet. Create your first rule to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Escalations */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Escalations</CardTitle>
            <CardDescription>Latest automatic escalations triggered by your rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs?.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Conversation {log.conversation_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">
                      {log.reason} • {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{log.triggered_by}</Badge>
                </div>
              ))}
              {(!logs || logs.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  No escalations recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}