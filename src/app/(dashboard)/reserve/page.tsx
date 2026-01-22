'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Calendar, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getCategoryIcon } from '@/lib/utils'
import { EquipmentWithStatus } from '@/types'
import { addDays, format } from 'date-fns'

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM',
]

export default function ReservePage() {
  const [equipment, setEquipment] = useState<EquipmentWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pickupDate, setPickupDate] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchEquipment()
  }, [])

  async function fetchEquipment() {
    try {
      const res = await fetch('/api/equipment')
      if (res.ok) {
        const data = await res.json()
        setEquipment(data)
      }
    } catch (error) {
      console.error('Error fetching equipment:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleReserveClick(item: EquipmentWithStatus) {
    setSelectedEquipment(item)
    const tomorrow = addDays(new Date(), 1)
    setPickupDate(format(tomorrow, 'yyyy-MM-dd'))
    setPickupTime('09:00 AM')
    setReturnDate(format(addDays(tomorrow, item.maxCheckoutDays), 'yyyy-MM-dd'))
    setDialogOpen(true)
  }

  async function handleReserve() {
    if (!selectedEquipment || !pickupDate || !pickupTime || !returnDate) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: selectedEquipment.id,
          pickupDate,
          pickupTime,
          returnDate,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Reservation Created',
          description: `${selectedEquipment.name} reserved for ${format(new Date(pickupDate), 'MMM d, yyyy')}`,
          variant: 'success',
        })
        setDialogOpen(false)
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to create reservation',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create reservation',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEquipment = equipment.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.equipmentId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reserve Equipment</h1>
        <p className="text-muted-foreground">Book equipment for future dates</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search equipment..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEquipment.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    {item.photoUrl ? (
                      <Image
                        src={item.photoUrl}
                        alt={item.name}
                        fill
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                        {getCategoryIcon(item.category)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.equipmentId}</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      Max {item.maxCheckoutDays} days
                    </Badge>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleReserveClick(item)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Reserve
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Reservation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reserve Equipment</DialogTitle>
            <DialogDescription>
              Schedule a future pickup for {selectedEquipment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              {selectedEquipment?.photoUrl ? (
                <Image
                  src={selectedEquipment.photoUrl}
                  alt={selectedEquipment.name}
                  width={60}
                  height={60}
                  className="rounded-lg object-cover"
                />
              ) : (
                <div className="w-15 h-15 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                  {getCategoryIcon(selectedEquipment?.category || '')}
                </div>
              )}
              <div>
                <h4 className="font-semibold">{selectedEquipment?.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedEquipment?.equipmentId}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupDate">Pickup Date</Label>
                <Input
                  id="pickupDate"
                  type="date"
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupTime">Pickup Time</Label>
                <Select value={pickupTime} onValueChange={setPickupTime}>
                  <SelectTrigger id="pickupTime">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="returnDate">Return Date</Label>
              <Input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={pickupDate}
                max={pickupDate ? format(addDays(new Date(pickupDate), selectedEquipment?.maxCheckoutDays || 7), 'yyyy-MM-dd') : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Maximum reservation period: {selectedEquipment?.maxCheckoutDays} days
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReserve} disabled={submitting || !pickupDate || !pickupTime || !returnDate}>
              {submitting ? 'Creating...' : 'Create Reservation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
