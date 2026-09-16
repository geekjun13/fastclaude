import { useEffect } from 'react';
import { Icon } from './components/index.tsx';
import { GlassSurface, useGlassTier } from './glass/GlassSurface.tsx';
import { useAppState, useDispatch } from './core/store.tsx';
import type { Tab } from './core/types.ts';
import { CalendarScreen } from './features/calendar/CalendarScreen.tsx';
import { BriefScreen } from './features/brief/BriefScreen.tsx';
import { EduScreen } from './features/edu/EduScreen.tsx';
import { GroupsScreen } from './features/groups/GroupsScreen.tsx';
import { CycleScreen } from './features/cycle/CycleScreen.tsx';
import { Onboarding } from './features/onboarding/Onboarding.tsx';
import './App.css';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'calendar', label: '캘린더', icon: 'calendar' },
  { id: 'brief', label: '브리프', icon: 'sunrise' },
  { id: 'edu', label: '에듀', icon: 'school' },
  { id: 'groups', label: '그룹', icon: 'users' },
  { id: 'cycle', label: 'Cycle', icon: 'sparkle' },
];

export default function App() {
  const state = useAppState();
  const dispatch = useDispatch();
  const tier = useGlassTier();
  const { profile, ui } = state;

  // Edu is only meaningful for an Edu account; hide it rather than showing a
  // tab that leads to a wall. Everyone else gets Groups in its place.
  const tabs = TABS.filter((t) => t.id !== 'edu' || profile?.accountType === 'edu');

  useEffect(() => {
    document.documentElement.dataset.glass = tier;
  }, [tier]);

  if (!profile) return <><div className="canvas-field" /><Onboarding /></>;

  return (
    <div className="app">
      <div className="canvas-field" />

      <main className="app-main">
        {ui.tab === 'calendar' ? <CalendarScreen />
          : ui.tab === 'brief' ? <BriefScreen />
          : ui.tab === 'edu' ? <EduScreen />
          : ui.tab === 'groups' ? <GroupsScreen />
          : <CycleScreen />}
      </main>

      <GlassSurface elevation={2} radius={22} className="tabbar" as="nav" aria-label="주요 화면">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-current={ui.tab === t.id ? 'page' : undefined}
            onClick={() => dispatch({ type: 'ui/tab', tab: t.id })}
          >
            <Icon name={t.icon} size={21} filled={ui.tab === t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </GlassSurface>
    </div>
  );
}
