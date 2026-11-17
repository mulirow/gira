import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type ResourcesPageProps = {
  searchParams: Promise<{ location?: string; operationalStatus?: string }>;
};

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const selectedLocation = params.location ?? "all";
  const selectedOperationalStatus = ["AVAILABLE", "IN_MAINTENANCE", "BROKEN"].includes(params.operationalStatus ?? "")
    ? params.operationalStatus
    : "all";
  const [allResources, locations, managerAssignments, isAdmin] = await Promise.all([
    prisma.resource.findMany({
      where: {
        space: { isActive: true },
        ...(selectedLocation !== "all" ? { location: selectedLocation } : {}),
        ...(selectedOperationalStatus !== "all"
          ? { operationalStatus: selectedOperationalStatus as "AVAILABLE" | "IN_MAINTENANCE" | "BROKEN" }
          : {}),
      },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    }),
    prisma.resource.findMany({
      where: { space: { isActive: true } },
      distinct: ["location"],
      select: { location: true },
      orderBy: { location: "asc" },
    }),
    prisma.spaceManager.findMany({
      where: { managerId: session.user.id, space: { isActive: true } },
      select: { space: { select: { id: true, name: true } } },
    }),
    isAdminUser(session.user.id),
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
          <Link href="/bookings">Agendamentos</Link>
          {managerAssignments.length > 0 && <Link href="/review">Analisar solicitações</Link>}
          {isAdmin && <Link href="/admin/spaces">Gerenciar espaços</Link>}
          <SignOutButton />
        </nav>
      </header>

      <section className="resource-catalog" aria-labelledby="resource-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Infraestrutura acadêmica</p>
            <h1 id="resource-heading">Catálogo de recursos</h1>
          </div>
          <div className="resource-catalog-actions">
            <p className="resource-count" aria-live="polite">
              {allResources.length} {allResources.length === 1 ? "recurso" : "recursos"}
            </p>
            {managerAssignments.length > 0 && (
              <Link className="resource-manage-link" href="/resources/manage">
                Gerenciar recursos
              </Link>
            )}
          </div>
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
          <label htmlFor="resource-operational-status">
            Condição operacional
            <select id="resource-operational-status" name="operationalStatus" defaultValue={selectedOperationalStatus}>
              <option value="all">Todas as condições</option>
              <option value="AVAILABLE">Disponível</option>
              <option value="IN_MAINTENANCE">Em manutenção</option>
              <option value="BROKEN">Quebrado</option>
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
            <p>Altere os filtros para ver recursos de outras localizações ou condições operacionais.</p>
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
                  {resources.map((resource) => {
                    const unavailableForBooking = resource.operationalStatus !== "AVAILABLE";
                    const statusLabel = resource.operationalStatus === "IN_MAINTENANCE"
                      ? "Em manutenção"
                      : resource.operationalStatus === "BROKEN"
                        ? "Quebrado"
                        : "Disponível";

                    return (
                    <li className="resource-item" key={resource.id}>
                      <article className={unavailableForBooking ? "is-operationally-unavailable" : ""}>
                        <div className="resource-item-heading">
                          <h3>{resource.name}</h3>
                          <span className={`resource-status is-${resource.operationalStatus.toLowerCase().replaceAll("_", "-")}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="resource-description">{resource.description}</p>
                        {unavailableForBooking && (
                          <p className="resource-condition-warning">
                            Novas reservas bloqueadas enquanto o recurso estiver {resource.operationalStatus === "BROKEN" ? "quebrado" : "em manutenção"}.
                          </p>
                        )}
                      </article>
                    </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}