'use client'

import { useEffect, useState } from 'react'
import { apiFetch, formatEGP, formatDateTime } from '@/lib/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, X, CheckCircle, Wallet } from 'lucide-react'
import { toast } from 'sonner'

export function ReceiptPrint({ sale, onClose }: { sale: any; onClose: () => void }) {
  const [receipt, setReceipt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [printed, setPrinted] = useState(false)

  useEffect(() => {
    apiFetch('/print', {
      method: 'POST',
      body: JSON.stringify({ saleId: sale.id })
    }).then(setReceipt).finally(() => setLoading(false))
  }, [sale.id])

  const handlePrint = () => {
    window.print()
    setPrinted(true)
    toast.success('تم إرسال الإيصال للطباعة')
  }

  const handleOpenDrawer = () => {
    // Simulate ESC/POS cash drawer kick command
    toast.success('تم فتح درج النقود')
  }

  if (loading) return null

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm no-print">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            تمت الفاتورة بنجاح
          </DialogTitle>
        </DialogHeader>

        {!loading && receipt && (
          <div className="space-y-3">
            <div className="text-center p-3 bg-green-500/10 rounded-lg">
              <p className="font-bold text-lg">{receipt.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">{formatEGP(receipt.total)}</p>
            </div>

            {/* Receipt preview */}
            <div className="border-2 border-dashed rounded-lg p-3 font-mono text-xs receipt-preview max-h-60 overflow-y-auto">
              <ReceiptContent receipt={receipt} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handlePrint} className="h-12">
                <Printer className="w-4 h-4 ml-2" />
                طباعة الإيصال
              </Button>
              <Button variant="outline" onClick={handleOpenDrawer} className="h-12">
                <Wallet className="w-4 h-4 ml-2" />
                فتح الدرج
              </Button>
            </div>

            {printed && (
              <p className="text-xs text-center text-muted-foreground">
                ✓ تم الإرسال للطابعة الحرارية
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Print-only receipt */}
      {receipt && (
        <div className="receipt-print hidden">
          <ReceiptContent receipt={receipt} />
        </div>
      )}
    </Dialog>
  )
}

function ReceiptContent({ receipt }: { receipt: any }) {
  return (
    <div className="text-center" dir="rtl">
      {receipt.store?.logo && (
        <img src={receipt.store.logo} alt="logo" className="mx-auto mb-2 w-16" />
      )}
      <p className="font-bold text-base">{receipt.store?.name || 'متجر النجاح'}</p>
      {receipt.store?.address && <p className="text-[10px]">{receipt.store.address}</p>}
      {receipt.store?.phone && <p className="text-[10px]">ت: {receipt.store.phone}</p>}
      <div className="border-t border-b border-dashed my-2 py-1">
        <p className="text-[10px]">فاتورة رقم: {receipt.invoiceNumber}</p>
        <p className="text-[10px]">{formatDateTime(receipt.date)}</p>
        <p className="text-[10px]">الكاشير: {receipt.cashier}</p>
        {receipt.customer && <p className="text-[10px]">العميل: {receipt.customer.name}</p>}
      </div>

      <div className="text-right">
        {receipt.items?.map((item: any, i: number) => (
          <div key={i} className="flex justify-between text-[10px] py-0.5">
            <span className="flex-1">{item.nameAr || item.name}</span>
            <span className="pos-number">{item.quantity}×</span>
            <span className="pos-number w-16 text-left">{formatEGP(item.unitPrice)}</span>
            <span className="pos-number w-16 text-left">{formatEGP(item.total)}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-dashed mt-2 pt-1 text-[10px]">
        <div className="flex justify-between">
          <span>المجموع الفرعي:</span>
          <span className="pos-number">{formatEGP(receipt.subtotal)}</span>
        </div>
        {receipt.discountAmount > 0 && (
          <div className="flex justify-between">
            <span>الخصم:</span>
            <span className="pos-number">- {formatEGP(receipt.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>الضريبة:</span>
          <span className="pos-number">{formatEGP(receipt.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm border-t border-dashed mt-1 pt-1">
          <span>الإجمالي:</span>
          <span className="pos-number">{formatEGP(receipt.total)}</span>
        </div>
      </div>

      <div className="border-t border-dashed mt-1 pt-1 text-[10px]">
        <div className="flex justify-between">
          <span>طريقة الدفع: {receipt.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>المدفوع:</span>
          <span className="pos-number">{formatEGP(receipt.paidAmount)}</span>
        </div>
        {receipt.changeAmount > 0 && (
          <div className="flex justify-between">
            <span>الباقي:</span>
            <span className="pos-number">{formatEGP(receipt.changeAmount)}</span>
          </div>
        )}
      </div>

      {receipt.loyaltyEarned > 0 && (
        <div className="border-t border-dashed mt-1 pt-1 text-[10px]">
          <p>النقاط المكتسبة: {receipt.loyaltyEarned}</p>
        </div>
      )}

      <div className="border-t border-dashed mt-2 pt-1">
        <p className="text-[10px]">{receipt.store?.receiptFooter || 'شكراً لزيارتكم'}</p>
        <p className="text-[10px] mt-1">*** {receipt.invoiceNumber} ***</p>
      </div>
    </div>
  )
}
