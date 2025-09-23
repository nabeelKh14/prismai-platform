"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarInitials } from "@/components/ui/avatar"
import { 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Calendar,
  MoreHorizontal,
  User,
  Star,
  Filter
} from "lucide-react"
import { cn } from "@/lib/utils"
import DotGrid from '@/components/DotGrid'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  company: string
  status: 'active' | 'inactive' | 'prospect'
  leadScore: number
  lastContact: string
  totalCalls: number
  totalBookings: number
  satisfaction: number
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Mock data for demonstration
  const mockCustomers: Customer[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john.doe@company.com",
      phone: "+1 (555) 123-4567",
      company: "Tech Innovations Inc",
      status: "active",
      leadScore: 85,
      lastContact: "2 hours ago",
      totalCalls: 12,
      totalBookings: 3,
      satisfaction: 4.8
    },
    {
      id: "2", 
      name: "Sarah Wilson",
      email: "sarah.w@marketing.co",
      phone: "+1 (555) 987-6543",
      company: "Marketing Solutions",
      status: "prospect",
      leadScore: 72,
      lastContact: "1 day ago",
      totalCalls: 5,
      totalBookings: 1,
      satisfaction: 4.5
    },
    {
      id: "3",
      name: "Michael Chen",
      email: "m.chen@startup.io",
      phone: "+1 (555) 456-7890",
      company: "StartupIO",
      status: "active",
      leadScore: 91,
      lastContact: "3 hours ago",
      totalCalls: 18,
      totalBookings: 5,
      satisfaction: 4.9
    },
    {
      id: "4",
      name: "Emily Rodriguez",
      email: "emily@consulting.biz",
      phone: "+1 (555) 321-9876",
      company: "Rodriguez Consulting",
      status: "inactive",
      leadScore: 45,
      lastContact: "2 weeks ago",
      totalCalls: 3,
      totalBookings: 0,
      satisfaction: 3.2
    }
  ]

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setCustomers(mockCustomers)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.company.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || customer.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'prospect': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'inactive': return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Customers</h1>
          <p className="text-gray-400 mt-2">
            Manage your customer relationships and track interactions
          </p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{customers.length}</div>
            <div className="text-sm text-green-400 mt-1">+12% from last month</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {customers.filter(c => c.status === 'active').length}
            </div>
            <div className="text-sm text-gray-400 mt-1">Currently active</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {(customers.reduce((sum, c) => sum + c.satisfaction, 0) / customers.length).toFixed(1)}
            </div>
            <div className="text-sm text-gray-400 mt-1">⭐ Rating</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Interactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {customers.reduce((sum, c) => sum + c.totalCalls + c.totalBookings, 0)}
            </div>
            <div className="text-sm text-gray-400 mt-1">Calls & bookings</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search customers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-700/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-700/50 border border-gray-600 rounded-md px-3 py-2 text-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700">
                <TableHead className="text-gray-400">Customer</TableHead>
                <TableHead className="text-gray-400">Contact</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Lead Score</TableHead>
                <TableHead className="text-gray-400">Interactions</TableHead>
                <TableHead className="text-gray-400">Last Contact</TableHead>
                <TableHead className="text-gray-400">Satisfaction</TableHead>
                <TableHead className="text-gray-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id} className="border-gray-700 hover:bg-gray-700/30">
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-gradient-to-r from-cyan-500 to-pink-500 text-white">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-white">{customer.name}</div>
                        <div className="text-sm text-gray-400">{customer.company}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm text-gray-300">
                        <Mail className="h-3 w-3 mr-1" />
                        {customer.email}
                      </div>
                      <div className="flex items-center text-sm text-gray-300">
                        <Phone className="h-3 w-3 mr-1" />
                        {customer.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", getStatusColor(customer.status))}>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className={cn("font-medium", getScoreColor(customer.leadScore))}>
                      {customer.leadScore}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-white">{customer.totalCalls} calls</div>
                      <div className="text-gray-400">{customer.totalBookings} bookings</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">{customer.lastContact}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span className="text-white">{customer.satisfaction}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}