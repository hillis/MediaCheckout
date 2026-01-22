'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Filter, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { formatDate, STATUS_COLORS, getCategoryIcon } from '@/lib/utils'
import { EquipmentWithStatus } from '@/types'
import { addDays, format } from 'date-fns'

const categories = ['all', 'Camera', 'Lens', 'Audio', 'Lighting', 'Grip', 'Other']

export default function BrowsePage() {
  const [equipment, setEquipment] = useState<EquipmentWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithStatus | null>(null)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchEquipment()
  }, [category])

  async function fetchEquipment() {
    try {
      const params = new URLSearchParams()
      if (category !== 'all') params.set('category', category)
      if (search) params.set('search', search)

      const res = await fetch(`/api/equipment?${params}`)
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

  function handleCheckoutClick(item: EquipmentWithStatus) {
    setSelectedEquipment(item)
    setDueDate(format(addDays(new Date(), item.maxCheckoutDays), 'yyyy-MM-dd'))
    setCheckoutDialogOpen(true)
  }

  async function handleCheckout() {
    if (!selectedEquipment) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/checkouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: selectedEquipment.id,
          dueDate,
        }),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: `${selectedEquipment.name} has been checked out`,
          variant: 'success',
        })
        setCheckoutDialogOpen(false)
        fetchEquipment()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to checkout equipment',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to checkout equipment',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredEquipment = equipment.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.equipmentId.toLowerCase().includes(search.toLowerCase()) ||
      item.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Equipment</h1>
        <p className="text-muted-foreground">Find and checkout equipment for your projects</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search equipment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEquipment.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No equipment found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEquipment.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-square relative bg-gray-100">
                {item.photoUrl ? (
                  <Image src={item.photoUrl} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">
                    {getCategoryIcon(item.category)}
                  </div>
                )}
                <Badge className={`absolute top-2 right-2 ${STATUS_COLORS[item.status]}`}>
                  {item.status.replace('_', ' ')}
                </Badge>
              </div>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold truncate">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.equipmentId}</span>
                </div>
                {item.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                )}
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button
                  className="w-full"
                  disabled={item.status !== 'AVAILABLE'}
                  onClick={() => handleCheckoutClick(item)}
                >
                  {item.status === 'AVAILABLE' ? 'Checkout' : 'Unavailable'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Checkout Equipment</DialogTitle>
            <DialogDescription>
              Confirm your checkout for {selectedEquipment?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              {selectedEquipment?.photoUrl ? (
                <Image
                  src={selectedEquipment.photoUrl}
                  alt={selectedEquipment.name}
                  width={80}
                  height={80}
                  className="rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-2xl">
                  {getCategoryIcon(selectedEquipment?.category || '')}
                </div>
              )}
              <div>
                <h4 className="font-semibold">{selectedEquipment?.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedEquipment?.equipmentId}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
                max={format(addDays(new Date(), selectedEquipment?.maxCheckoutDays || 7), 'yyyy-MM-dd')}
              />
              <p className="text-xs text-muted-foreground">
                Maximum checkout period: {selectedEquipment?.maxCheckoutDays} days
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>Late fee: ${selectedEquipment?.dailyLateFee?.toFixed(2)}/day</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={submitting}>
              {submitting ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
