import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Package } from 'lucide-react';
import { articleCategories } from '@shared/catalog/articles';
import { api } from '../api';
import { Button, DifficultyBadge, ErrorState, PageLoading } from '../components/ui';
import { useI18n } from '../i18n';
import { padNumber } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { useAsync } from '../lib/useAsync';

/** Sentinel for "every category"; article categories come from content and are never empty. */
const ALL = '';

export function LearnPage() {
  const { t } = useI18n();
  const list = useAsync(() => api.listArticles(), []);
  const [category, setCategory] = useState<string>(ALL);
  const all = list.data?.items ?? [];
  const extraCategories = [...new Set(all.map((article) => article.category))].filter((name) => !(articleCategories as readonly string[]).includes(name)).sort();
  const categories = [ALL, ...articleCategories, ...extraCategories];
  const items = all.filter((article) => category === ALL || article.category === category);

  return (
    <div className="container page">
      <header className="page-header">
        <p className="eyebrow">{t.learn.eyebrow}</p>
        <h1>{t.learn.title} <span className="gradient-text">{t.learn.titleAccent}</span></h1>
        <p className="hero-lead">{t.learn.lead}</p>
      </header>
      <div className="toolbar">
        <div className="toolbar-group" role="group" aria-label={t.learn.filterByCategory}>
          {categories.map((item) => (
            <Button key={item} variant="toggle" size="sm" active={category === item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item === ALL ? t.learn.all : item}</Button>
          ))}
        </div>
      </div>
      {list.loading ? <PageLoading /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : (
        <div className="article-grid">
          {items.map((article) => (
            <Link key={article.slug} to={`/learn/${article.slug}`} className="article-card">
              <span className="article-card-top"><span className="article-category">{article.category}</span>{article.source && <span className="source-chip"><Package size={11} />{article.source.packName}</span>}</span>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
              <span className="mono-dim"><Clock size={12} /> {t.common.readingTime(article.readingMinutes)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticlePage() {
  const { t } = useI18n();
  const { slug = '' } = useParams();
  const article = useAsync(() => api.getArticle(slug), [slug]);
  const problemList = useAsync(() => api.listProblems(), []);
  if (article.loading) return <PageLoading />;
  if (article.error || !article.data) return <div className="container page"><ErrorState message={article.error ?? t.api.articleNotFound} onRetry={article.reload} /></div>;
  const item = article.data;
  const related = (problemList.data?.items ?? []).filter((problem) => item.relatedProblems.includes(problem.id));

  return (
    <div className="container page">
      <Link to="/learn" className="back-link"><ArrowLeft size={14} />{t.learn.back}</Link>
      <div className="article-layout">
        <article>
          <p className="eyebrow">// {item.category.toUpperCase()} · {item.readingMinutes} MIN{item.source ? ` · ${item.source.packName.toUpperCase()}` : ''}</p>
          <h1 className="article-title">{item.title}</h1>
          <p className="hero-lead">{item.summary}</p>
          <Markdown source={item.body} />
        </article>
        <aside className="article-side">
          <section className="panel">
            <h2 className="panel-title">{t.learn.applyOnCanvas}</h2>
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
