import { CampaignForm } from '@/components/campaign-form'

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สร้าง Campaign ใหม่</h1>
      <CampaignForm />
    </div>
  )
}
