import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Recycle, Users, PiggyBank, Leaf, GraduationCap, BookOpen, TreePine } from "lucide-react"

const globalKPIs = {
  itemsReused: 12847,
  familiesHelped: 4231,
  moneySaved: 186430,
  co2Avoided: 3246,
}

const topSchools = [
  { rank: 1, name: "CEIP San Miguel", city: "Madrid", items: 1560, families: 342 },
  { rank: 2, name: "IES Cervantes", city: "Madrid", items: 1340, families: 289 },
  { rank: 3, name: "Colegio La Salle", city: "Barcelona", items: 1190, families: 267 },
  { rank: 4, name: "CEIP Goya", city: "Zaragoza", items: 980, families: 198 },
  { rank: 5, name: "IES Lope de Vega", city: "Sevilla", items: 870, families: 176 },
  { rank: 6, name: "CEIP Miguel de Cervantes", city: "Valencia", items: 790, families: 163 },
  { rank: 7, name: "Colegio Maristas", city: "Bilbao", items: 720, families: 148 },
  { rank: 8, name: "IES Ramon y Cajal", city: "Malaga", items: 680, families: 134 },
  { rank: 9, name: "CEIP Federico Garcia Lorca", city: "Granada", items: 610, families: 121 },
  { rank: 10, name: "Colegio Santa Maria", city: "Valladolid", items: 540, families: 108 },
]

const regionImpact = [
  { region: "Madrid", items: 3420, families: 890, schools: 24 },
  { region: "Cataluna", items: 2810, families: 720, schools: 18 },
  { region: "Andalucia", items: 2140, families: 560, schools: 15 },
  { region: "Comunidad Valenciana", items: 1560, families: 410, schools: 11 },
  { region: "Pais Vasco", items: 980, families: 280, schools: 8 },
  { region: "Aragon", items: 710, families: 190, schools: 6 },
  { region: "Castilla y Leon", items: 620, families: 170, schools: 5 },
  { region: "Galicia", items: 480, families: 130, schools: 4 },
]

const odsCards = [
  {
    number: 4,
    title: "Educacion de Calidad",
    description: "Facilitamos el acceso a materiales educativos para todas las familias, reduciendo barreras economicas en la educacion.",
    iconBg: "bg-sky-100",
    iconColor: "text-sky-600",
    cardBg: "bg-sky-50/60",
    borderColor: "border-sky-200/60",
  },
  {
    number: 12,
    title: "Produccion y Consumo Responsables",
    description: "Promovemos la reutilizacion de material escolar, alargando su vida util y reduciendo residuos innecesarios.",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    cardBg: "bg-amber-50/60",
    borderColor: "border-amber-200/60",
  },
  {
    number: 13,
    title: "Accion por el Clima",
    description: "Cada articulo reutilizado evita la fabricacion de uno nuevo, reduciendo emisiones de CO2 y el impacto ambiental.",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    cardBg: "bg-emerald-50/60",
    borderColor: "border-emerald-200/60",
  },
]

function formatNumber(n: number) {
  return n.toLocaleString("es-ES")
}

export default function RankingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
          {/* Header */}
          <div className="text-center">
            <Badge variant="outline" className="mb-3 text-primary border-primary/30">Impacto social</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Ranking de colegios colaboradores
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground leading-relaxed">
              Juntos creamos una comunidad educativa mas sostenible. Estos son los numeros de impacto de todos los centros colaboradores de Wetudy.
            </p>
          </div>

          {/* Global KPIs */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Recycle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(globalKPIs.itemsReused)}</p>
                  <p className="text-sm text-muted-foreground">Articulos reutilizados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(globalKPIs.familiesHelped)}</p>
                  <p className="text-sm text-muted-foreground">Familias beneficiadas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10">
                  <PiggyBank className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(globalKPIs.moneySaved)}&euro;</p>
                  <p className="text-sm text-muted-foreground">Ahorro estimado</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10">
                  <Leaf className="h-6 w-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{formatNumber(globalKPIs.co2Avoided)} kg</p>
                  <p className="text-sm text-muted-foreground">CO2 evitado</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TOP 10 Schools */}
          <Card className="mt-10 border-border">
            <CardHeader>
              <CardTitle className="text-foreground">TOP 10 centros colaboradores</CardTitle>
              <CardDescription>Los centros educativos con mayor impacto en la reutilizacion de material escolar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Centro Educativo</TableHead>
                      <TableHead className="text-right">Articulos reutilizados</TableHead>
                      <TableHead className="text-right">Familias beneficiadas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSchools.map(s => (
                      <TableRow key={s.rank}>
                        <TableCell>
                          {s.rank <= 3 ? (
                            <Badge variant={s.rank === 1 ? "default" : "outline"} className={
                              s.rank === 1 ? "bg-amber-500 text-amber-950" :
                              s.rank === 2 ? "border-zinc-400 text-zinc-500" :
                              "border-amber-700 text-amber-700"
                            }>
                              {s.rank}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground font-medium pl-2">{s.rank}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-foreground">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.city}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(s.items)}</TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(s.families)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Impact by Region */}
          <Card className="mt-8 border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Impacto por Comunidad Autonoma</CardTitle>
              <CardDescription>Desglose del impacto social por region.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Comunidad Autonoma</TableHead>
                      <TableHead className="text-right">Articulos reutilizados</TableHead>
                      <TableHead className="text-right">Familias beneficiadas</TableHead>
                      <TableHead className="text-right">Centros educativos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionImpact.map(r => (
                      <TableRow key={r.region}>
                        <TableCell className="font-medium text-foreground">{r.region}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.items)}</TableCell>
                        <TableCell className="text-right">{formatNumber(r.families)}</TableCell>
                        <TableCell className="text-right">{r.schools}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ODS Section */}
          <div className="mt-14">
            <div className="text-center">
              <Badge variant="outline" className="mb-3 text-primary border-primary/30">Naciones Unidas</Badge>
              <h2 className="text-2xl font-bold text-foreground sm:text-3xl text-balance">
                Objetivos de Desarrollo Sostenible
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground leading-relaxed">
                Cada reutilizacion cuenta. Wetudy contribuye directamente a tres ODS de la Agenda 2030.
              </p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {odsCards.map(ods => (
                <div
                  key={ods.number}
                  className={`rounded-xl border ${ods.borderColor} ${ods.cardBg} p-6 shadow-sm`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-full ${ods.iconBg} ${ods.iconColor}`}>
                    {ods.number === 4 && <GraduationCap className="h-6 w-6" />}
                    {ods.number === 12 && <BookOpen className="h-6 w-6" />}
                    {ods.number === 13 && <TreePine className="h-6 w-6" />}
                  </div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    ODS {ods.number}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-foreground leading-tight">{ods.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {ods.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
