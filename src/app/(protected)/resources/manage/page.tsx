import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createResource, deleteResource, updateResourceStatus } from "../actions";
import ResourceEditForm from "./resource-edit-form";

type ManageResourcesPageProps = {
  searchParams: Promise<{ result?: string }>;
};

const resultMessages: Record<string, string> = {
  created: "Recurso cadastrado.",
  "name-taken": "Já existe um recurso com esse nome neste espaço.",
  "details-updated": "Informações do recurso atualizadas.",
  "status-updated": "Condição operacional atualizada.",
  "resource-deleted": "Recurso excluído.",
  "resource-has-bookings": "Este recurso não pode ser excluído porque possui histórico de reservas.",
  invalid: "Confira os dados informados e tente novamente.",
  unavailable: "Não foi possível concluir a operação neste espaço.",
};

const statusLabels = {
  AVAILABLE: "Disponível",
  IN_MAINTENANCE: "Em manutenção",
  BROKEN: "Quebrado",
} as const;

export default async function ManageResourcesPage({ searchParams }: ManageResourcesPageProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [assignments, params] = await Promise.all([
    prisma.spaceManager.findMany({
      where: { managerId: session.user.id, space: { isActive: true } },
      select: {
        space: {
          select: {
            id: true,
            name: true,
            resources: { orderBy: { name: "asc" } },
          },
        },
      },
      orderBy: { space: { name: "asc" } },
    }),
    searchParams,
  ]);

  if (assignments.length === 0) redirect("/resources");

  const resultMessage = params.result ? resultMessages[params.result] : undefined;

  return (
    <main className="dashboard-page resources-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/dashboard">Painel</Link>
          <Link href="/resources">Catálogo</Link>
          <Link href="/bookings">Agendamentos</Link>
          <Link href="/review">Analisar solicitações</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="resource-catalog" aria-labelledby="manage-resources-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Área de gestão</p>
            <h1 id="manage-resources-heading">Gerenciar recursos</h1>
          </div>
          <Link className="resource-filter-reset" href="/resources">Voltar ao catálogo</Link>
        </div>

        {resultMessage && <p className="resource-action-feedback" role="status">{resultMessage}</p>}

        <div className="resource-location-groups">
          {assignments.map(({ space }) => (
            <section key={space.id} aria-labelledby={`managed-space-${space.id}`}>
              <h2 id={`managed-space-${space.id}`} className="resource-location-heading">
                <span>{space.name}</span>
                <span className="resource-count">{space.resources.length} recursos</span>
              </h2>

              <section className="resource-manager-tools" aria-label={`Cadastrar recurso em ${space.name}`}>
                <h3>Cadastrar recurso</h3>
                <form className="resource-create-form" action={createResource}>
                  <input type="hidden" name="spaceId" value={space.id} />
                  <label htmlFor={`new-resource-name-${space.id}`}>
                    Nome
                    <input id={`new-resource-name-${space.id}`} name="name" minLength={2} maxLength={100} required />
                  </label>
                  <label htmlFor={`new-resource-description-${space.id}`}>
                    Descrição
                    <textarea id={`new-resource-description-${space.id}`} name="description" minLength={2} maxLength={1000} required />
                  </label>
                  <label htmlFor={`new-resource-status-${space.id}`}>
                    Condição inicial
                    <select id={`new-resource-status-${space.id}`} name="operationalStatus" defaultValue="AVAILABLE" required>
                      <option value="AVAILABLE">Disponível</option>
                      <option value="IN_MAINTENANCE">Em manutenção</option>
                      <option value="BROKEN">Quebrado</option>
                    </select>
                  </label>
                  <button type="submit">Cadastrar</button>
                </form>
              </section>

              {space.resources.length === 0 ? (
                <p className="resource-empty">Ainda não há recursos cadastrados neste espaço.</p>
              ) : (
                <ul className="resource-manage-list">
                  {space.resources.map((resource) => (
                    <li key={resource.id}>
                      <div className="resource-manage-heading">
                        <ResourceEditForm
                          resourceId={resource.id}
                          name={resource.name}
                          description={resource.description}
                        />
                        <span className={`resource-status is-${resource.operationalStatus.toLowerCase().replaceAll("_", "-")}`}>
                          {statusLabels[resource.operationalStatus]}
                        </span>
                      </div>
                      <div className="resource-manage-controls">
                        <form className="resource-status-form" action={updateResourceStatus}>
                          <input type="hidden" name="resourceId" value={resource.id} />
                          <label htmlFor={`resource-status-${resource.id}`}>
                            Condição operacional
                            <select
                              id={`resource-status-${resource.id}`}
                              name="operationalStatus"
                              defaultValue={resource.operationalStatus}
                            >
                              <option value="AVAILABLE">Disponível</option>
                              <option value="IN_MAINTENANCE">Em manutenção</option>
                              <option value="BROKEN">Quebrado</option>
                            </select>
                          </label>
                          <button type="submit">Salvar</button>
                        </form>
                        <details className="resource-delete-control">
                          <summary>Excluir recurso</summary>
                          <p>A exclusão é permanente e só está disponível para recursos sem histórico de reservas.</p>
                          <form action={deleteResource}>
                            <input type="hidden" name="resourceId" value={resource.id} />
                            <button type="submit">Confirmar exclusão</button>
                          </form>
                        </details>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}