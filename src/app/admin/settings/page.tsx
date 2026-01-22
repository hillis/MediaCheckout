'use client'

import { useState, useEffect } from 'react'
import { Save, Settings, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

type SettingsData = {
  defaultCheckoutDays: string
  defaultLateFee: string
  reminderDaysBefore: string
  defaultClassroomId: string
}

type Classroom = {
  id: string
  name: string
  owner: { name: string | null }
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingsData>({
    defaultCheckoutDays: '7',
    defaultLateFee: '5.00',
    reminderDaysBefore: '1',
    defaultClassroomId: '',
  })
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
    fetchClassrooms()
  }, [])

  async function fetchSettings() {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          defaultCheckoutDays: data.defaultCheckoutDays || '7',
          defaultLateFee: data.defaultLateFee || '5.00',
          reminderDaysBefore: data.reminderDaysBefore || '1',
          defaultClassroomId: data.defaultClassroomId || '',
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchClassrooms() {
    try {
      const res = await fetch('/api/classrooms')
      if (res.ok) {
        const data = await res.json()
        setClassrooms(data)
      }
    } catch (error) {
      console.error('Error fetching classrooms:', error)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        toast({
          title: 'Success',
          description: 'Settings saved',
          variant: 'success',
        })
      } else {
        toast({
          title: 'Error',
          description: 'Failed to save settings',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-48 bg-gray-200 rounded" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure system defaults</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Checkout Settings
          </CardTitle>
          <CardDescription>Default values for new equipment and checkouts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultCheckoutDays">Default Checkout Period (days)</Label>
              <Input
                id="defaultCheckoutDays"
                type="number"
                min="1"
                value={settings.defaultCheckoutDays}
                onChange={(e) => setSettings({ ...settings, defaultCheckoutDays: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Default maximum days for equipment checkout
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultLateFee">Default Late Fee ($/day)</Label>
              <Input
                id="defaultLateFee"
                type="number"
                min="0"
                step="0.01"
                value={settings.defaultLateFee}
                onChange={(e) => setSettings({ ...settings, defaultLateFee: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Default daily late fee for overdue items
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminderDaysBefore">Due Date Reminder (days before)</Label>
              <Input
                id="reminderDaysBefore"
                type="number"
                min="0"
                value={settings.reminderDaysBefore}
                onChange={(e) => setSettings({ ...settings, reminderDaysBefore: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Send reminder email this many days before due date
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            New User Settings
          </CardTitle>
          <CardDescription>Configure defaults for new users signing in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="defaultClassroom">Default Classroom for New Users</Label>
            <Select
              value={settings.defaultClassroomId}
              onValueChange={(value) => setSettings({ ...settings, defaultClassroomId: value })}
            >
              <SelectTrigger id="defaultClassroom">
                <SelectValue placeholder="No default classroom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (users join manually)</SelectItem>
                {classrooms.map((classroom) => (
                  <SelectItem key={classroom.id} value={classroom.id}>
                    {classroom.name} {classroom.owner?.name ? `(${classroom.owner.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              New users from allowed domains will automatically be added to this classroom as students
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Info</CardTitle>
          <CardDescription>System configuration information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Database:</span> Vercel Postgres
            </p>
            <p>
              <span className="font-medium">Authentication:</span> Google OAuth via NextAuth.js
            </p>
            <p className="text-muted-foreground">
              Email notifications require setting up a cron job or Vercel Edge Function to send reminders.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
