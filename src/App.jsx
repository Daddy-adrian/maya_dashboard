import React, { useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { EngagementProvider, useEngagement } from './context/EngagementContext';
import Dashboard from './components/Dashboard';
import MysteryChestModal from './components/MysteryChestModal';
import StoryGame from './games/StoryGame';
import NextLevelReadingGame from './games/NextLevelReadingGame';
import RemiGame from './games/RemiGame';
import DirectionPigGame from './games/DirectionPigGame';
import OddOneOutGame from './games/OddOneOutGame';
import TetrisGame from './games/TetrisGame';
import BlankSentencesGame from './games/BlankSentencesGame';

function PhonixShell() {
  const { markModulePlayed } = useEngagement();
  const [activeView, setActiveView] = useState({ moduleId: null, mode: null });

  const openModule = (moduleId, mode = null) => {
    markModulePlayed(moduleId);
    setActiveView({ moduleId, mode });
  };

  const exitToDashboard = () => {
    setActiveView({ moduleId: null, mode: null });
  };

  const renderActiveGame = () => {
    switch (activeView.moduleId) {
      case 'story-comprehension':
        return <StoryGame key="story" onExit={exitToDashboard} />;
      case 'next-level-reading':
        return <NextLevelReadingGame key="next-level" onExit={exitToDashboard} />;
      case 'cvc-rummikub':
        return <RemiGame key="remi" onExit={exitToDashboard} />;
      case 'direction-pig':
        return <DirectionPigGame key="pig" onExit={exitToDashboard} />;
      case 'odd-one-out':
        return <OddOneOutGame key="ooo" onExit={exitToDashboard} />;
      case 'am-is-are':
        return activeView.mode === 'sentences' ? (
          <BlankSentencesGame key="am-sent" mode="am_is_are" onExit={exitToDashboard} />
        ) : (
          <TetrisGame key="am-tetris" mode="am_is_are" onExit={exitToDashboard} />
        );
      case 'have-has-tetris':
        return activeView.mode === 'sentences' ? (
          <BlankSentencesGame key="hh-sent" mode="have_has" onExit={exitToDashboard} />
        ) : (
          <TetrisGame key="hh-tetris" mode="have_has" onExit={exitToDashboard} />
        );
      default:
        return <Dashboard key="dashboard" onOpenModule={openModule} />;
    }
  };

  return (
    <>
      {renderActiveGame()}
      <MysteryChestModal />
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <EngagementProvider>
        <PhonixShell />
      </EngagementProvider>
    </MotionConfig>
  );
}
