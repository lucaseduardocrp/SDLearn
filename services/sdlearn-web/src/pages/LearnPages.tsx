import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Package } from 'lucide-react';
import { articleCategories } from '@shared/catalog/articles';
import { api } from '../api';
import { DifficultyBadge, ErrorState, PageLoading } from '../components/ui';
import { padNumber } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { useAsync } from '../lib/useAsync';

export function LearnPage() {
  const list = useAsync(() => api.listArticles(), []);
  const [category, setCategory] = useState<string>('Todos');
  const all = list.data?.items ?? [];
  const extraCategories = [...new Set(all.map((article) => article.category))].filter((name) => !(articleCategories as readonly string[]).includes(name)).sort();
  const categories = ['Todos', ...articleCategories, ...extraCategories];
  const items = all.filter((article) => category === 'Todos' || article.category === category);

  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">// LEARNING LIBRARY</p>
        <h1>Aprenda o conceito. <span className="gradient-text">Aplique no canvas.</span></h1>
        <p className="hero-lead">Artigos diretos ao ponto sobre os blocos de construção que os juízes esperam ver — cada um ligado aos problemas onde ele faz diferença.</p>
      </header>
      <div className="filter-pills" role="group" aria-label="Filtrar por categoria">
        {categories.map((item) => (
          <button key={item} className={`pill${category === item ? ' active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>
        ))}
      </div>
      {list.loading ? <PageLoading /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <div className="article-grid">
          {items.map((article) => (
            <Link key={article.slug} to={`/learn/${article.slug}`} className="article-card">
              <span className="article-card-top"><span className="article-category">{article.category}</span>{article.source && <span className="source-chip"><Package size={11} />{article.source.packName}</span>}</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <span className="mono-dim"><Clock size={12} /> {article.readingMinutes} min de leitura</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticlePage() {
  const { slug = '' } = useParams();
  const article = useAsync(() => api.getArticle(slug), [slug]);
  const problemList = useAsync(() => api.listProblems(), []);
  if (article.loading) return <PageLoading />;
  if (article.error || !article.data) return <div className="container page"><ErrorState message={article.error ?? 'Artigo não encontrado.'} onRetry={article.reload} /></div>;
  const item = article.data;
  const related = (problemList.data?.items ?? []).filter((problem) => item.relatedProblems.includes(problem.id));

  return (
    <div className="container page">
      <Link to="/learn" className="back-link"><ArrowLeft size={14} />Aprender</Link>
      <div className="article-layout">
        <article>
          <p className="eyebrow">// {item.category.toUpperCase()} · {item.readingMinutes} MIN{item.source ? ` · ${item.source.packName.toUpperCase()}` : ''}</p>
          <h1 className="article-title">{item.title}</h1>
          <p className="hero-lead">{item.summary}</p>
          <Markdown source={item.body} />
        </article>
        <aside className="article-side">
          <section className="panel">
            <h2 className="panel-title">Aplique no canvas</h2>
            <ul className="mini-list">
              {related.map((problem) => (
                <li key={problem.id}>
                  <Link to={`/problems/${problem.id}`}>
                    <span><strong>{problem.title}</strong><small>{padNumber(problem.number)} · {problem.tags.join(', ')}</small></span>
                    <span className="mini-list-score"><DifficultyBadge difficulty={problem.difficulty} /><ArrowRight size={14} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
