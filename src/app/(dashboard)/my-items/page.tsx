'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Package, Calendar, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { formatDate, formatRelative, STATUS_COLORS, getCategoryIcon, isOverdue, getDaysUntilDue } from '@/lib/utils'
import { CheckoutWithDetails, ReservationWithDetails } from '@/types'

export default function MyItemsPage() {
  const [checkouts, setCheckouts] = useState<CheckoutWithDetails[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [checkoutsRes, reservationsRes] = await Promise.all([
        fetch('/api/checkouts?status=ACTIVE'),
        fetch('/api/reservations?status=PENDING'),
      ])

      if (checkoutsRes.ok) {
        setCheckouts(await checkoutsRes.json())
      }
      if (reservationsRes.ok) {
        setReservations(await reservationsRes.json())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleReturn(checkoutId: string) {
    try {
      const res = await fetch(`/api/checkouts/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return' }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Equipment returned successfully',
          variant: 'success',
        })
        fetchData()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to return equipment',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to return equipment',
        variant: 'destructive',
      })
    }
  }

  async function handleCancelReservation(reservationId: string) {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Reservation cancelled',
          variant: 'success',
        })
        fetchData()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to cancel reservation',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel reservation',
        variant: 'destructive',
      })
    }
  }

  async function handlePickup(reservationId: string) {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pickup' }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Equipment picked up successfully',
          variant: 'success',
        })
        fetchData()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to pickup equipment',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pickup equipment',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Items</h1>
        <p className="text-muted-foreground">Manage your checkouts and reservations</p>
      </div>

      <Tabs defaultValue="checkouts">
        <TabsList>
          <TabsTrigger value="checkouts">
            Active Checkouts ({checkouts.length})
          </TabsTrigger>
          <TabsTrigger value="reservations">
            Reservations ({reservations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkouts" className="space-y-4 mt-4">
          {checkouts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No active checkouts</h3>
                <p className="text-sm text-muted-foreground">
                  Browse equipment to start a checkout
                </p>
              </CardContent>
            </Card>
          ) : (
            checkouts.map((checkout) => {
              const overdue = isOverdue(checkout.dueDate)
              const daysUntil = getDaysUntilDue(checkout.dueDate)

              return (
                <Card key={checkout.id} className={overdue ? 'border-destructive' : ''}>
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative w-20 h-20 flex-shrink-0">
                        {checkout.equipment.photoUrl ? (
                          <Image
                            src={checkout.equipment.photoUrl}
                            alt={checkout.equipment.name}
                            fill
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                            {getCategoryIcon(checkout.equipment.category)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{checkout.equipment.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {checkout.equipment.equipmentId}
                            </p>
                          </div>
                          {overdue && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Checked out: {formatDate(checkout.checkoutDate)}
                          </span>
                          <span className={`flex items-center gap-1 ${overdue ? 'text-destructive' : ''}`}>
                            <Clock className="h-4 w-4" />
                            Due: {formatDate(checkout.dueDate)}
                            {!overdue && daysUntil <= 2 && (
                              <span className="text-yellow-600">({daysUntil} day{daysUntil !== 1 ? 's' : ''} left)</span>
                            )}
                          </span>
                        </div>
                        {overdue && (
                          <p className="mt-2 text-sm text-destructive">
                            Late fee: ${checkout.equipment.dailyLateFee}/day
                          </p>
                        )}
                      </div>
                      <Button onClick={() => handleReturn(checkout.id)} className="flex-shrink-0">
                        Return
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="reservations" className="space-y-4 mt-4">
          {reservations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold">No pending reservations</h3>
                <p className="text-sm text-muted-foreground">
                  Reserve equipment for future dates
                </p>
              </CardContent>
            </Card>
          ) : (
            reservations.map((reservation) => (
              <Card key={reservation.id}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative w-20 h-20 flex-shrink-0">
                      {reservation.equipment.photoUrl ? (
                        <Image
                          src={reservation.equipment.photoUrl}
                          alt={reservation.equipment.name}
                          fill
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                          {getCategoryIcon(reservation.equipment.category)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{reservation.equipment.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {reservation.equipment.equipmentId}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Pickup: {formatDate(reservation.pickupDate)} at {reservation.pickupTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Return: {formatDate(reservation.returnDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="outline" onClick={() => handleCancelReservation(reservation.id)}>
                        Cancel
                      </Button>
                      <Button onClick={() => handlePickup(reservation.id)}>
                        Pickup
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
