'use client'

import { useState, useEffect, useRef } from 'react'
import { Camera, Search, Package, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'

export default function ReturnPage() {
  const [scanning, setScanning] = useState(false)
  const [manualId, setManualId] = useState('')
  const [processing, setProcessing] = useState(false)
  const [lastReturned, setLastReturned] = useState<{ name: string; id: string } | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setScanning(true)
      }
    } catch (error) {
      toast({
        title: 'Camera Error',
        description: 'Unable to access camera. Please use manual entry.',
        variant: 'destructive',
      })
    }
  }

  function stopScanner() {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setScanning(false)
  }

  async function handleReturn(equipmentId: string) {
    if (!equipmentId.trim()) return

    setProcessing(true)
    try {
      // First, find active checkout for this equipment
      const checkoutsRes = await fetch('/api/checkouts?status=ACTIVE')
      if (!checkoutsRes.ok) throw new Error('Failed to fetch checkouts')

      const checkouts = await checkoutsRes.json()
      const checkout = checkouts.find(
        (c: { equipment: { equipmentId: string } }) =>
          c.equipment.equipmentId.toLowerCase() === equipmentId.toLowerCase()
      )

      if (!checkout) {
        toast({
          title: 'Not Found',
          description: `No active checkout found for equipment ID: ${equipmentId}`,
          variant: 'destructive',
        })
        return
      }

      // Return the equipment
      const res = await fetch(`/api/checkouts/${checkout.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'return' }),
      })

      if (res.ok) {
        const result = await res.json()
        setLastReturned({ name: checkout.equipment.name, id: checkout.equipment.equipmentId })
        setManualId('')

        if (result.lateFeeAmount > 0) {
          toast({
            title: 'Returned with Late Fee',
            description: `${checkout.equipment.name} returned. Late fee: $${result.lateFeeAmount.toFixed(2)}`,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Success',
            description: `${checkout.equipment.name} has been returned`,
            variant: 'success',
          })
        }
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
        description: 'Failed to process return',
        variant: 'destructive',
      })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Return Equipment</h1>
        <p className="text-muted-foreground">Scan or enter equipment ID to return</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Scanner Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan QR/Barcode
            </CardTitle>
          </CardHeader>
          <CardContent>
            {scanning ? (
              <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-white/50 rounded-lg" />
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Position the barcode within the frame
                </p>
                <Button variant="outline" className="w-full" onClick={stopScanner}>
                  Stop Scanner
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <Camera className="h-12 w-12 text-muted-foreground" />
                </div>
                <Button className="w-full" onClick={startScanner}>
                  Start Scanner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Entry Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Manual Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Enter equipment ID (e.g., CAM-001)"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReturn(manualId)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the equipment ID found on the label
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => handleReturn(manualId)}
                disabled={!manualId.trim() || processing}
              >
                {processing ? 'Processing...' : 'Return Equipment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Returned */}
      {lastReturned && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Successfully Returned</h3>
              <p className="text-sm text-muted-foreground">
                {lastReturned.name} ({lastReturned.id})
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
