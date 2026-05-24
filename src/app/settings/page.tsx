'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [exportError, setExportError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExportError(false)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ads-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError(true)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('loading')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setImportStatus(res.ok ? 'ok' : 'error')
    } catch {
      setImportStatus('error')
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export / Import ข้อมูล</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับ backup
            </p>
            <Button onClick={handleExport} variant="outline">
              Export JSON
            </Button>
            {exportError && (
              <p className="text-sm text-destructive mt-2">Export ล้มเหลว ลองใหม่อีกครั้ง</p>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <p className="text-sm text-muted-foreground mb-1">
              นำเข้าข้อมูลจากไฟล์ JSON
            </p>
            <p className="text-xs text-destructive mb-3">
              ⚠️ การ import จะลบข้อมูลทั้งหมดที่มีอยู่และแทนที่ด้วยข้อมูลจากไฟล์
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <Button
              variant="outline"
              disabled={importStatus === 'loading'}
              onClick={() => fileRef.current?.click()}
            >
              {importStatus === 'loading' ? 'กำลัง import...' : 'Import JSON'}
            </Button>
            {importStatus === 'ok' && (
              <p className="text-sm text-green-500 mt-2">Import สำเร็จ</p>
            )}
            {importStatus === 'error' && (
              <p className="text-sm text-destructive mt-2">Import ล้มเหลว ตรวจสอบไฟล์อีกครั้ง</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
