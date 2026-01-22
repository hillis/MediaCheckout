'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Package, Users, Calendar, AlertCircle, DollarSign, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency, formatRelative, STATUS_COLORS } from '@/lib/utils'

type DashboardData = {
  stats: {
    totalEquipment: number
    availableEquipment: number
    activeCheckouts: number
    overdueCheckouts: number
    pendingReservations: number
    totalLateFees: number
  }
  recentCheckouts: Array<{
    id: string
    status: string
    checkoutDate: string
    equipment: { name: string; equipmentId: string }
    user: { name: string | null; email: string | null }
  }>
  overdueItems: Array<{
    id: string
    dueDate: string
    equipment: { name: string; equipmentId: string; dailyLateFee: number }
    user: { name: string | null; email: string | null }
  }>
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/dashboard')
      if (res.ok) {
        setData(await res.json())
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return <div>Failed to load dashboard</div>
  }

  const stats = [
    {
      title: 'Total Equipment',
      value: data.stats.totalEquipment,
      description: `${data.stats.availableEquipment} available`,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-100',
    },
    {
      title: 'Active Checkouts',
      value: data.stats.activeCheckouts,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-100',
    },
    {
      title: 'Overdue Items',
      value: data.stats.overdueCheckouts,
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-100',
    },
    {
      title: 'Pending Reservations',
      value: data.stats.pendingReservations,
      icon: Calendar,
      color: 'text-yellow-600',
      bg: 'bg-yellow-100',
    },
    {
      title: 'Outstanding Fees',
      value: formatCurrency(data.stats.totalLateFees),
      icon: DollarSign,
      color: 'text-purple-600',
      bg: 'bg-purple-100',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of equipment and checkouts</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    {stat.description && (
                      <p className="text-xs text-muted-foreground">{stat.description}</p>
                    )}
                  </div>
                  <div className={`${stat.bg} p-3 rounded-full`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Overdue Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Overdue Items
            </CardTitle>
            <CardDescription>Items that need immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            {data.overdueItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No overdue items
              </p>
            ) : (
              <div className="space-y-4">
                {data.overdueItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{item.equipment.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.user.name || item.user.email}
                      </p>
                      <p className="text-xs text-red-600">
                        Due: {formatDate(item.dueDate)}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      ${item.equipment.dailyLateFee}/day
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Checkouts</CardTitle>
            <CardDescription>Latest checkout activity</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentCheckouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent checkouts
              </p>
            ) : (
              <div className="space-y-4">
                {data.recentCheckouts.map((checkout) => (
                  <div key={checkout.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div>
                      <p className="font-medium">{checkout.equipment.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkout.user.name || checkout.user.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(checkout.checkoutDate)}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[checkout.status as keyof typeof STATUS_COLORS]}>
                      {checkout.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/admin/equipment">Manage Equipment</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/users">View Users</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/settings">Settings</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
