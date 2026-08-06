import Link from "next/link";

import type { OrderBuilderProduct } from "@/features/product";

import styles from "./site-admin.module.css";

type SiteAdminProductsProps = Readonly<{
  products: readonly OrderBuilderProduct[];
}>;

export function SiteAdminProducts({ products }: SiteAdminProductsProps) {
  return (
    <>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Painel do Site</p>
        <h1 className={styles.title}>Produtos</h1>
        <p className={styles.description}>Produtos ativos cadastrados.</p>
      </header>

      <div className={styles.tableWrapper}>
        {products.length === 0 ? (
          <p className={styles.emptyState}>Nenhum produto encontrado.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Nome</th>
                <th scope="col">Referência</th>
                <th scope="col">Publicação</th>
                <th scope="col">Fotos</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <Link
                      className={styles.productLink}
                      href={`/painel/produtos/${encodeURIComponent(product.reference)}`}
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td>{product.reference}</td>
                  <td>
                    <span className={styles.unpublishedStatus}>
                      Não publicado
                    </span>
                  </td>
                  <td>0 fotos</td>
                  <td className={styles.actionsCell}>
                    <Link
                      className="ds-button ds-button--secondary"
                      href={`/painel/produtos/${encodeURIComponent(product.reference)}`}
                    >
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
