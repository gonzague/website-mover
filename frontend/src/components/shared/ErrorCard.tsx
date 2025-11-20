import { Card, CardContent } from '@/components/ui/card'

interface ErrorCardProps {
  error: string
}

export function ErrorCard({ error }: ErrorCardProps) {
  return (
    <Card className="mb-6 bg-red-900/20 border-red-700">
      <CardContent className="pt-6">
        <p className="text-red-400 font-semibold">Error: {error}</p>
      </CardContent>
    </Card>
  )
}
