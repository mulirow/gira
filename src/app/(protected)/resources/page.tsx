import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ResourcesPageProps = {
  searchParams: Promise<{ location?: string; status?: string }>;
};

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const selectedLocation = params.location ?? "all";
  const selectedStatus = ["active", "inactive"].includes(params.status ?? "")
    ? params.status
    : "all";
  const [allResources, locations] = await Promise.all([
    prisma.resource.findMany({
      where: {
        ...(selectedLocation !== "all" ? { location: selectedLocation } : {}),
        ...(selectedStatus === "active" ? { isActive: true } : {}),
        ...(selectedStatus === "inactive" ? { isActive: false } : {}),
      },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    }),
    prisma.resource.findMany({
      distinct: ["location"],
      select: { location: true },
      orderBy: { location: "asc" },
    }),
  ]);

  const resourcesByLocation = new Map<string, typeof allResources>();
  for (const resource of allResources) {
    const locationResources = resourcesByLocation.get(resource.location) ?? [];
    locationResources.push(resource);
    resourcesByLocation.set(resource.location, locationResources);
  }
  const hasAnyResources = locations.length > 0;

  return (
    <main className="dashboard-page resources-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/dashboard">Painel</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="resource-catalog" aria-labelledby="resource-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Infraestrutura acadêmica</p>
            <h1 id="resource-heading">Recursos disponíveis</h1>
          </div>
          <p className="resource-count" aria-live="polite">
            {allResources.length} {allResources.length === 1 ? "recurso" : "recursos"}
          </p>
        </div>

        <form className="resource-filters" action="/resources" aria-label="Filtrar recursos">
          <label htmlFor="resource-location">
            Localização
            <select id="resource-location" name="location" defaultValue={selectedLocation}>
              <option value="all">Todas as localizações</option>
              {locations.map(({ location }) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </label>
          <label htmlFor="resource-status">
            Status
            <select id="resource-status" name="status" defaultValue={selectedStatus}>
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </label>
          <button type="submit">Aplicar filtros</button>
          <Link className="resource-filter-reset" href="/resources">Limpar</Link>
        </form>

        {!hasAnyResources ? (
          <div className="resource-empty" role="status">
            <h2>Nenhum recurso cadastrado por enquanto</h2>
            <p>Quando novos espaços e equipamentos estiverem disponíveis, eles aparecerão aqui.</p>
          </div>
        ) : allResources.length === 0 ? (
          <div className="resource-empty" role="status">
            <h2>Nenhum recurso encontrado</h2>
            <p>Altere os filtros para ver recursos de outras localizações ou status.</p>
          </div>
        ) : (
          <div className="resource-location-groups">
            {[...resourcesByLocation].map(([location, resources], index) => (
              <section key={location} aria-labelledby={`location-heading-${index}`}>
                <h2 id={`location-heading-${index}`} className="resource-location-heading">
                  <span>{location}</span>
                  <span className="resource-count">
                    {resources.length} {resources.length === 1 ? "recurso" : "recursos"}
                  </span>
                </h2>
                <ul className="resource-grid">
                  {resources.map((resource) => (
                    <li className="resource-item" key={resource.id}>
                      <article>
                        <div className="resource-item-heading">
                          <h3>{resource.name}</h3>
                          <span className={`resource-status ${resource.isActive ? "is-active" : "is-inactive"}`}>
                            {resource.isActive ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <p className="resource-description">{resource.description}</p>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}