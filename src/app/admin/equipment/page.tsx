'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { STATUS_COLORS, getCategoryIcon } from '@/lib/utils'
import { EquipmentWithStatus } from '@/types'

const categories = ['Camera', 'Lens', 'Audio', 'Lighting', 'Grip', 'Other']
const statuses = ['AVAILABLE', 'CHECKED_OUT', 'RESERVED', 'MAINTENANCE']

type EquipmentForm = {
  equipmentId: string
  name: string
  category: string
  description: string
  photoUrl: string
  dailyLateFee: number
  maxCheckoutDays: number
  status: string
}

const defaultForm: EquipmentForm = {
  equipmentId: '',
  name: '',
  category: 'Camera',
  description: '',
  photoUrl: '',
  dailyLateFee: 5,
  maxCheckoutDays: 7,
  status: 'AVAILABLE',
}

export default function AdminEquipmentPage() {
  const [equipment, setEquipment] = useState<EquipmentWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<EquipmentForm>(defaultForm)
  const [submitting, setSubmitting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchEquipment()
  }, [])

  async function fetchEquipment() {
    try {
      const res = await fetch('/api/equipment')
      if (res.ok) {
        setEquipment(await res.json())
      }
    } catch (error) {
      console.error('Error fetching equipment:', error)
    } finally {
      setLoading(false)
    }
  }

  function openCreateDialog() {
    setForm(defaultForm)
    setEditingId(null)
    setDialogOpen(true)
  }

  function openEditDialog(item: EquipmentWithStatus) {
    setForm({
      equipmentId: item.equipmentId,
      name: item.name,
      category: item.category,
      description: item.description || '',
      photoUrl: item.photoUrl || '',
      dailyLateFee: item.dailyLateFee,
      maxCheckoutDays: item.maxCheckoutDays,
      status: item.status,
    })
    setEditingId(item.id)
    setDialogOpen(true)
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      const url = editingId ? `/api/equipment/${editingId}` : '/api/equipment'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: editingId ? 'Equipment updated' : 'Equipment created',
          variant: 'success',
        })
        setDialogOpen(false)
        fetchEquipment()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to save equipment',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save equipment',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deletingId) return

    try {
      const res = await fetch(`/api/equipment/${deletingId}`, { method: 'DELETE' })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Equipment deleted',
          variant: 'success',
        })
        setDeleteDialogOpen(false)
        fetchEquipment()
      } else {
        const error = await res.json()
        toast({
          title: 'Error',
          description: error.error || 'Failed to delete equipment',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete equipment',
        variant: 'destructive',
      })
    }
  }

  const filteredEquipment = equipment.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.equipmentId.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Equipment Management</h1>
          <p className="text-muted-foreground">Add, edit, and manage equipment inventory</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Equipment
        </Button>
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

      {/* Equipment List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-16 bg-gray-200 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEquipment.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-semibold">No equipment found</h3>
            <Button className="mt-4" onClick={openCreateDialog}>
              Add Equipment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredEquipment.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge className={STATUS_COLORS[item.status]}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.equipmentId} | {item.category}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Late fee: ${item.dailyLateFee}/day | Max: {item.maxCheckoutDays} days
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setDeletingId(item.id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update equipment details' : 'Add a new item to the inventory'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="equipmentId">Equipment ID</Label>
                <Input
                  id="equipmentId"
                  value={form.equipmentId}
                  onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}
                  placeholder="CAM-001"
                  disabled={!!editingId}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Canon EOS R5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoUrl">Photo URL</Label>
              <Input
                id="photoUrl"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dailyLateFee">Daily Late Fee ($)</Label>
                <Input
                  id="dailyLateFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.dailyLateFee}
                  onChange={(e) => setForm({ ...form, dailyLateFee: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxCheckoutDays">Max Checkout Days</Label>
                <Input
                  id="maxCheckoutDays"
                  type="number"
                  min="1"
                  value={form.maxCheckoutDays}
                  onChange={(e) => setForm({ ...form, maxCheckoutDays: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            {editingId && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.equipmentId || !form.name}>
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Equipment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this equipment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
