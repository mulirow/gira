import Link from "next/link";
import SignOutButton from "@/components/sign-out-button";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import {
  archiveSpace,
  assignSpaceManager,
  createSpace,
  restoreSpace,
  revokeSpaceManager,
  updateSpace,
} from "./actions";

type AdminSpacesPageProps = {
  searchParams: Promise<{ spaceId?: string; q?: string; result?: string }>;
};

const feedback: Record<string, string> = {
  created: "Espaço criado.",
  updated: "Espaço atualizado.",
  archived: "Espaço excluído do catálogo e arquivado. O histórico foi preservado.",
  restored: "Espaço restaurado.",
  "manager-assigned": "Gerente atribuído ao espaço.",
  "manager-revoked": "Acesso de gerente removido para este espaço.",
  "has-bookings": "O espaço não pode ser excluído enquanto houver solicitações pendentes ou reservas em andamento ou futuras.",
  "invalid-name": "O nome deve ter entre 2 e 100 caracteres.",
  "name-taken": "Já existe um espaço com esse nome.",
  unavailable: "A alteração não pôde ser concluída. Atualize a página e tente novamente.",
};

export default async function AdminSpacesPage({ searchParams }: AdminSpacesPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const spaces = await prisma.space.findMany({
    include: {
      managerAssignments: {
        include: { manager: { select: { id: true, name: true, email: true } } },
        orderBy: { assignedAt: "asc" },
      },
      _count: { select: { resources: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const selectedSpace = spaces.find((space) => space.id === params.spaceId)
    ?? spaces.find((space) => space.isActive)
    ?? spaces[0];
  const candidates = selectedSpace?.isActive && query.length >= 2
    ? await prisma.user.findMany({
        where: {
          managedSpaces: { none: { spaceId: selectedSpace.id } },
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 10,
      })
    : [];

  return (
    <main className="dashboard-page admin-spaces-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/">gira<span>.</span></Link>
        <nav className="resources-navigation" aria-label="Navegação principal">
          <Link href="/dashboard">Painel</Link>
          <Link href="/resources">Recursos</Link>
          <SignOutButton />
        </nav>
      </header>

      <section className="admin-spaces-workspace" aria-labelledby="admin-spaces-heading">
        <div className="resource-catalog-heading">
          <div>
            <p className="eyebrow">Administração</p>
            <h1 id="admin-spaces-heading">Espaços e gerentes</h1>
          </div>
        </div>

        {params.result && feedback[params.result] && (
          <p className={`admin-feedback ${params.result === "has-bookings" || params.result === "invalid-name" || params.result === "name-taken" || params.result === "unavailable" ? "is-error" : "is-success"}`} role="status">
            {feedback[params.result]}
          </p>
        )}

        <form className="admin-create-space" action={createSpace}>
          <label htmlFor="new-space-name">Novo espaço</label>
          <div>
            <input id="new-space-name" name="name" maxLength={100} required />
            <button type="submit">Criar espaço</button>
          </div>
        </form>

        <div className="admin-space-layout">
          <nav className="admin-space-list" aria-label="Espaços cadastrados">
            <h2>Espaços</h2>
            {spaces.length === 0 ? (
              <p>Nenhum espaço cadastrado.</p>
            ) : (
              <ul>
                {spaces.map((space) => (
                  <li key={space.id}>
                    <Link
                      href={`/admin/spaces?spaceId=${encodeURIComponent(space.id)}`}
                      aria-current={space.id === selectedSpace?.id ? "page" : undefined}
                      className={`${space.id === selectedSpace?.id ? "is-selected" : ""} ${space.isActive ? "" : "is-archived"}`}
                    >
                      <span>{space.name}</span>
                      <small>{space.isActive ? `${space._count.resources} recursos` : "Arquivado"}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          {selectedSpace ? (
            <section className="admin-space-detail" aria-labelledby="selected-space-heading">
              <div className="admin-space-title">
                <div>
                  <p className="eyebrow">{selectedSpace.isActive ? "Espaço ativo" : "Espaço arquivado"}</p>
                  <h2 id="selected-space-heading">{selectedSpace.name}</h2>
                </div>
                <span className="resource-count">{selectedSpace._count.resources} recursos</span>
              </div>

              {selectedSpace.isActive ? (
                <>
                  <form className="admin-edit-space" action={updateSpace}>
                    <input type="hidden" name="spaceId" value={selectedSpace.id} />
                    <label htmlFor="edit-space-name">Nome do espaço</label>
                    <div>
                      <input id="edit-space-name" name="name" defaultValue={selectedSpace.name} maxLength={100} required />
                      <button type="submit">Salvar</button>
                    </div>
                  </form>

                  <section className="admin-manager-section" aria-labelledby="manager-list-heading">
                    <div className="admin-section-heading">
                      <h3 id="manager-list-heading">Gerentes deste espaço</h3>
                      <span>{selectedSpace.managerAssignments.length}</span>
                    </div>
                    {selectedSpace.managerAssignments.length === 0 ? (
                      <p className="admin-empty">Nenhum gerente atribuído.</p>
                    ) : (
                      <ul className="admin-manager-list">
                        {selectedSpace.managerAssignments.map(({ manager }) => (
                          <li key={manager.id}>
                            <div><strong>{manager.name}</strong><span>{manager.email}</span></div>
                            <form action={revokeSpaceManager}>
                              <input type="hidden" name="spaceId" value={selectedSpace.id} />
                              <input type="hidden" name="managerId" value={manager.id} />
                              <button type="submit" aria-label={`Remover ${manager.name} deste espaço`}>Remover</button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="admin-manager-search" aria-labelledby="manager-search-heading">
                    <h3 id="manager-search-heading">Atribuir gerente</h3>
                    <form action="/admin/spaces" className="admin-search-form">
                      <input type="hidden" name="spaceId" value={selectedSpace.id} />
                      <label htmlFor="user-search">Buscar usuário por nome ou e-mail</label>
                      <div>
                        <input id="user-search" name="q" type="search" defaultValue={query} minLength={2} />
                        <button type="submit">Buscar</button>
                      </div>
                    </form>
                    {query.length >= 2 && (
                      candidates.length === 0 ? (
                        <p className="admin-empty">Nenhum usuário disponível encontrado.</p>
                      ) : (
                        <ul className="admin-candidate-list">
                          {candidates.map((user) => (
                            <li key={user.id}>
                              <div><strong>{user.name}</strong><span>{user.email}</span></div>
                              <form action={assignSpaceManager}>
                                <input type="hidden" name="spaceId" value={selectedSpace.id} />
                                <input type="hidden" name="managerId" value={user.id} />
                                <button type="submit" aria-label={`Atribuir ${user.name} como gerente`}>Atribuir</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </section>

                  <details className="admin-archive-space">
                    <summary>Excluir espaço</summary>
                    <p>O espaço será arquivado. O histórico de reservas será mantido; espaços com solicitações pendentes ou reservas em andamento ou futuras não podem ser excluídos.</p>
                    <form action={archiveSpace}>
                      <input type="hidden" name="spaceId" value={selectedSpace.id} />
                      <button type="submit">Confirmar exclusão</button>
                    </form>
                  </details>
                </>
              ) : (
                <form action={restoreSpace}>
                  <input type="hidden" name="spaceId" value={selectedSpace.id} />
                  <button className="admin-restore-button" type="submit">Restaurar espaço</button>
                </form>
              )}
            </section>
          ) : (
            <div className="resource-empty" role="status">
              <h2>Crie o primeiro espaço</h2>
              <p>Depois, você poderá encontrar usuários e atribuí-los como gerentes.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}