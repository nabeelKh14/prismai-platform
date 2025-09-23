'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Plus, Users, Settings, Crown, UserPlus, Mail, Calendar } from 'lucide-react'
import DotGrid from '@/components/DotGrid'

interface Tenant {
  id: string
  name: string
  description?: string
  industry?: string
  size?: string
  subscription_status: string
  trial_ends_at?: string
  created_at: string
}

interface TenantUser {
  id: string
  user_id: string
  role: string
  is_active: boolean
  joined_at: string
  user: {
    id: string
    email: string
    business_name?: string
  }
}

interface TenantInvitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

export default function TenantManagementPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [invitations, setInvitations] = useState<TenantInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    industry: '',
    size: 'small' as const,
  })

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user' as const,
  })

  useEffect(() => {
    loadTenants()
  }, [])

  const loadTenants = async () => {
    try {
      const response = await fetch('/api/tenants')
      if (response.ok) {
        const data = await response.json()
        setTenants(data.tenants)
        if (data.tenants.length > 0 && !selectedTenant) {
          setSelectedTenant(data.tenants[0])
          loadTenantDetails(data.tenants[0].id)
        }
      }
    } catch (error) {
      toast.error('Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  const loadTenantDetails = async (tenantId: string) => {
    try {
      // Load tenant users
      const usersResponse = await fetch(`/api/tenants/${tenantId}/users`)
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setTenantUsers(usersData.users)
      }

      // Load invitations
      const invitesResponse = await fetch(`/api/tenants/invitations?tenantId=${tenantId}`)
      if (invitesResponse.ok) {
        const invitesData = await invitesResponse.json()
        setInvitations(invitesData.invitations)
      }
    } catch (error) {
      toast.error('Failed to load tenant details')
    }
  }

  const handleCreateTenant = async () => {
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })

      if (response.ok) {
        toast.success('Tenant created successfully')
        setShowCreateDialog(false)
        setCreateForm({ name: '', description: '', industry: '', size: 'small' })
        loadTenants()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create tenant')
      }
    } catch (error) {
      toast.error('Failed to create tenant')
    }
  }

  const handleInviteUser = async () => {
    if (!selectedTenant) return

    try {
      const response = await fetch('/api/tenants/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': selectedTenant.id,
        },
        body: JSON.stringify(inviteForm),
      })

      if (response.ok) {
        toast.success('Invitation sent successfully')
        setShowInviteDialog(false)
        setInviteForm({ email: '', role: 'user' })
        loadTenantDetails(selectedTenant.id)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send invitation')
      }
    } catch (error) {
      toast.error('Failed to send invitation')
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default'
      case 'admin': return 'secondary'
      case 'manager': return 'outline'
      default: return 'outline'
    }
  }

  const getSubscriptionBadgeVariant = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'trial': return 'secondary'
      case 'cancelled': return 'destructive'
      default: return 'outline'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Interactive dot-grid background */}
      <DotGrid
        dotSize={2}
        gap={24}
        baseColor="#00ffff"
        activeColor="#ffffff"
        proximity={120}
        speedTrigger={50}
        shockRadius={200}
        shockStrength={3}
        className="fixed inset-0 z-0"
        style={{ opacity: 0.6 }}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Management</h1>
          <p className="text-muted-foreground">Manage your organizations and team members</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Tenant
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Tenant</DialogTitle>
              <DialogDescription>
                Create a new organization to manage your business operations.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Tenant Name</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="My Business"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Brief description of your organization"
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Select value={createForm.industry} onValueChange={(value) => setCreateForm({ ...createForm, industry: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="size">Company Size</Label>
                <Select value={createForm.size} onValueChange={(value: any) => setCreateForm({ ...createForm, size: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Startup (1-10)</SelectItem>
                    <SelectItem value="small">Small (11-50)</SelectItem>
                    <SelectItem value="medium">Medium (51-200)</SelectItem>
                    <SelectItem value="large">Large (201-1000)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateTenant} className="w-full">
                Create Tenant
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tenants found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first organization to get started with multi-tenant management.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Tenant
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Tenant List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Tenants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tenants.map((tenant) => (
                  <div
                    key={tenant.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedTenant?.id === tenant.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedTenant(tenant)
                      loadTenantDetails(tenant.id)
                    }}
                  >
                    <div className="font-medium">{tenant.name}</div>
                    <div className="text-sm opacity-75">
                      <Badge variant={getSubscriptionBadgeVariant(tenant.subscription_status)} className="text-xs">
                        {tenant.subscription_status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Tenant Details */}
          <div className="lg:col-span-3">
            {selectedTenant ? (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="users">Team Members</TabsTrigger>
                  <TabsTrigger value="invitations">Invitations</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedTenant.name}</CardTitle>
                      <CardDescription>{selectedTenant.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Industry</Label>
                          <p className="text-sm text-muted-foreground">{selectedTenant.industry || 'Not specified'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Size</Label>
                          <p className="text-sm text-muted-foreground">{selectedTenant.size || 'Not specified'}</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Status</Label>
                          <Badge variant={getSubscriptionBadgeVariant(selectedTenant.subscription_status)}>
                            {selectedTenant.subscription_status}
                          </Badge>
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Created</Label>
                          <p className="text-sm text-muted-foreground">
                            {new Date(selectedTenant.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Team Members</h3>
                    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Team Member</DialogTitle>
                          <DialogDescription>
                            Send an invitation to join {selectedTenant.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              value={inviteForm.email}
                              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                              placeholder="user@example.com"
                            />
                          </div>
                          <div>
                            <Label htmlFor="role">Role</Label>
                            <Select value={inviteForm.role} onValueChange={(value: any) => setInviteForm({ ...inviteForm, role: value })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleInviteUser} className="w-full">
                            Send Invitation
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="space-y-2">
                    {tenantUsers.map((tenantUser) => (
                      <Card key={tenantUser.id}>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src="" />
                              <AvatarFallback>
                                {tenantUser.user.business_name?.[0] || tenantUser.user.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{tenantUser.user.business_name || tenantUser.user.email}</p>
                              <p className="text-sm text-muted-foreground">{tenantUser.user.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getRoleBadgeVariant(tenantUser.role)}>
                              {tenantUser.role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
                              {tenantUser.role}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Joined {new Date(tenantUser.joined_at).toLocaleDateString()}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="invitations" className="space-y-4">
                  <h3 className="text-lg font-semibold">Pending Invitations</h3>
                  <div className="space-y-2">
                    {invitations.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-8">
                          <Mail className="w-8 h-8 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No pending invitations</p>
                        </CardContent>
                      </Card>
                    ) : (
                      invitations.map((invitation) => (
                        <Card key={invitation.id}>
                          <CardContent className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarFallback>
                                  <Mail className="w-4 h-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{invitation.email}</p>
                                <p className="text-sm text-muted-foreground">
                                  Invited as {invitation.role}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">
                                <Calendar className="w-3 h-3 mr-1" />
                                Expires {new Date(invitation.expires_at).toLocaleDateString()}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tenant Settings</CardTitle>
                      <CardDescription>
                        Configure your tenant preferences and settings
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="tenant-name">Tenant Name</Label>
                          <Input
                            id="tenant-name"
                            value={selectedTenant.name}
                            onChange={(e) => setSelectedTenant({ ...selectedTenant, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="tenant-description">Description</Label>
                          <Textarea
                            id="tenant-description"
                            value={selectedTenant.description || ''}
                            onChange={(e) => setSelectedTenant({ ...selectedTenant, description: e.target.value })}
                          />
                        </div>
                        <Button>
                          <Settings className="w-4 h-4 mr-2" />
                          Save Changes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">Select a tenant to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}