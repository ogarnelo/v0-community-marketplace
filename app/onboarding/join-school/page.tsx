"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { BookOpen, Loader2, CheckCircle2, Search, School } from "lucide-react"
import { schools } from "@/lib/mock-data"
import Link from "next/link"

export default function JoinSchoolPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<typeof schools[0] | null>(null)
  const [error, setError] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setFound(null)

    setTimeout(() => {
      const school = schools.find(s => s.code.toLowerCase() === code.toLowerCase())
      if (school) {
        setFound(school)
      } else {
        setError("No hemos encontrado ningun centro con ese codigo. Revisa y vuelve a intentarlo.")
      }
      setLoading(false)
    }, 800)
  }

  const handleJoin = () => {
    setLoading(true)
    setTimeout(() => {
      router.push("/marketplace")
    }, 600)
  }

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold font-mono text-foreground">Wetudy</span>
      </Link>

      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground">Unete a tu centro</CardTitle>
          <CardDescription>
            Introduce el codigo de tu colegio, instituto o universidad para acceder a la comunidad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!found ? (
            <div className="flex flex-col gap-4">
              <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code">Codigo del centro</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ej: SANMIGUEL23"
                    className="text-center text-lg font-mono tracking-widest uppercase"
                    required
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buscar centro
                </Button>
              </form>

              <div className="relative flex items-center gap-2 py-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted-foreground">o</span>
                <div className="flex-1 border-t border-border" />
              </div>

              {!showSearch ? (
                <Button variant="outline" className="w-full gap-2" onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4" />
                  No tengo codigo, buscar centro
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o ciudad..."
                  />
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                    {filteredSchools.length === 0 ? (
                      <p className="p-3 text-center text-sm text-muted-foreground">No se encontraron centros</p>
                    ) : (
                      filteredSchools.map(school => (
                        <button
                          key={school.id}
                          type="button"
                          className="flex w-full items-center gap-3 border-b border-border p-3 text-left transition-colors last:border-b-0 hover:bg-muted"
                          onClick={() => { setFound(school) }}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                            <School className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{school.name}</p>
                            <p className="text-xs text-muted-foreground">{school.city} &middot; {school.memberCount} miembros</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Tu solicitud quedara pendiente hasta que el centro te confirme
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <Alert className="border-secondary/30 bg-secondary/5">
                <CheckCircle2 className="h-4 w-4 text-secondary" />
                <AlertTitle className="text-foreground">Centro encontrado</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  <strong className="text-foreground">{found.name}</strong><br />
                  {found.city} &middot; {found.type} &middot; {found.memberCount} miembros
                </AlertDescription>
              </Alert>

              <Button className="w-full" onClick={handleJoin} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unirme a {found.name}
              </Button>

              <Button variant="ghost" className="w-full text-sm" onClick={() => { setFound(null); setCode("") }}>
                Buscar otro centro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
