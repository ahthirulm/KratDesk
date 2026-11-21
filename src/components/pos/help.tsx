import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, BookOpen, Lightbulb, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle } from './shared';
import { HELP_SECTIONS, HELP_TOPICS, matchHelp, type HelpMatch } from '@/lib/help-topics';

type Turn = { ask: string; answers: HelpMatch[] };

const SUGGESTIONS = [
  'How do I reset the shop?',
  'Where do I take a backup?',
  'How do I split a payment?',
  'How do I record a repair cost?',
];

export function HelpCenter() {
  const [query, setQuery] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [section, setSection] = useState('All');
  const endRef = useRef<HTMLDivElement>(null);

  function ask(text?: string) {
    const question = (text ?? query).trim();
    if (!question) return;
    setTurns((previous) => [...previous, { ask: question, answers: matchHelp(question, 3) }]);
    setQuery('');
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60);
  }

  const visible = section === 'All' ? HELP_TOPICS : HELP_TOPICS.filter((topic) => topic.section === section);

  return <>
    <PageTitle title="Help" subtitle="Ask how anything is done — answers come from the shop's own screens" />

    <section className="dashboard-section help-chat">
      <div className="help-chat-head">
        <span className="help-chat-mark"><Sparkles size={18} /></span>
        <div><b>Ask a question</b><small className="block text-xs">For example: how do I reset the shop, or where do I add a staff salary?</small></div>
      </div>

      <div className="help-ask-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') ask(); }}
          placeholder="How do I…?"
          aria-label="Ask a help question"
        />
        <Button onClick={() => ask()} disabled={!query.trim()}><Send />Ask</Button>
      </div>
      {!turns.length && <div className="help-suggestions">
        {SUGGESTIONS.map((item) => <Button key={item} size="sm" variant="ghost" onClick={() => ask(item)}>{item}</Button>)}
      </div>}

      <div className="help-turns">
        {turns.map((turn, index) => <div className="help-turn" key={index}>
          <p className="help-ask">{turn.ask}</p>
          {turn.answers.length
            ? turn.answers.map(({ topic, score }) => <article className="help-answer" key={topic.id}>
              <div className="help-answer-head">
                <b>{topic.title}</b>
                <span className="help-confidence">{score > 12 ? 'Exact match' : 'Closest match'}</span>
              </div>
              <p className="help-summary">{topic.summary}</p>
              <ol className="help-steps">{topic.steps.map((step, n) => <li key={n}>{step}</li>)}</ol>
              <Button asChild size="sm" variant="outline"><Link to={topic.route as never}>{topic.routeLabel}<ArrowUpRight /></Link></Button>
            </article>)
            : <article className="help-answer">
              <div className="help-answer-head"><b>I could not match that to a screen yet</b></div>
              <p className="help-summary">Try a few words about the job — “reset”, “backup”, “split payment”, “repair cost”, “salary”, “transfer stock” — or browse the list below.</p>
            </article>}
        </div>)}
        {!turns.length && <div className="help-empty">
          <Lightbulb size={16} />
          <span>Start with one of these, or type your own question.</span>
        </div>}
        <div ref={endRef} />
      </div>
    </section>

    <section className="dashboard-section">
      <div className="dashboard-heading">
        <h2>Everything KaratDesk can do</h2>
        <span>{HELP_TOPICS.length} guides</span>
      </div>
      <div className="help-sections">
        {['All', ...HELP_SECTIONS].map((item) => <Button
          key={item}
          size="sm"
          variant={section === item ? 'default' : 'outline'}
          onClick={() => setSection(item)}
        >{item}</Button>)}
      </div>
      <div className="help-grid">
        {visible.map((topic) => <article className="help-card" key={topic.id}>
          <div className="help-card-head"><BookOpen size={15} /><b>{topic.title}</b></div>
          <p>{topic.summary}</p>
          <Button asChild size="sm" variant="ghost"><Link to={topic.route as never}>{topic.routeLabel}<ArrowUpRight /></Link></Button>
        </article>)}
      </div>
    </section>
  </>;
}
