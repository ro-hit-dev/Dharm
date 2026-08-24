import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import AuthScreen from './components/AuthScreen';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  loadCloudProfile,
  loadQuizAttemptDetails,
  loadQuizAttempts,
  recordQuizAttempt,
  saveCloudProfile,
  syncLocalProgress,
  type QuizAttemptDetails,
  type QuizAttemptSummary,
} from './lib/cloudSync';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { QUESTION_DAYS, type Question } from './data/questions';
import {
  BADGE_ICONS,
  BG_IMAGES,
  COLORS,
  DAY_DIFFICULTY,
  LANGS,
  LEVELS,
  LEVEL_START_DAYS,
  type Language,
} from './data/content';
import {
  clearState,
  isDayUnlocked,
  loadState,
  saveState,
  istDateString,
  type AnswerRecord,
  type DayProgress,
  type LocalQuizAttempt,
  type UserProfile,
} from './lib/storage';

type Screen = 'lang' | 'info' | 'main' | 'quiz' | 'auth' | 'review';
type Tab = 'home' | 'profile' | 'journey';
const initialSaved = loadState();

function Footer({ text }: { text: string }) {
  return <div className="footer">{text}</div>;
}

function App() {
  const [lang, setLang] = useState<Language | null>(initialSaved.user?.language ?? null);
  const [screen, setScreen] = useState<Screen>(initialSaved.user ? 'main' : 'auth');
  const [user, setUser] = useState<UserProfile>(initialSaved.user ?? { name: '', age: '', language: 'en' });
  const [formErr, setFormErr] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [showTrivia, setShowTrivia] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [quizStartedAt, setQuizStartedAt] = useState<string | null>(null);
  const [dayScores, setDayScores] = useState<Record<number, DayProgress>>(initialSaved.dayScores);
  const [attemptHistory, setAttemptHistory] = useState<Record<number, LocalQuizAttempt[]>>(initialSaved.attemptHistory);
  const [session, setSession] = useState<Session | null>(null);
  const [reviewAttempts, setReviewAttempts] = useState<QuizAttemptSummary[]>([]);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttemptDetails | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const currentLang = lang ?? user.language ?? 'en';
  const L = LANGS[currentLang];
  const qs = activeDay !== null ? QUESTION_DAYS[currentLang][activeDay] ?? QUESTION_DAYS.en[activeDay] ?? [] : [];
  const q: Question | undefined = qs[cur] ?? qs[0];
  const total = qs.length;

  useEffect(() => {
    // Never re-save a signed-out account while the auth screen is visible.
    // Guest data is marked with ownerId = null; authenticated data is namespaced
    // to the Supabase user ID so one account cannot migrate another account's cache.
    if (screen === 'auth') return;
    saveState({
      user: screen === 'lang' ? null : user,
      dayScores,
      attemptHistory,
      ownerId: session?.user.id ?? null,
    });
  }, [user, dayScores, attemptHistory, screen, session?.user.id]);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      setAuthChecking(false);
      return () => {
        mounted = false;
      };
    }

    async function hydrate(nextSession: Session | null) {
      if (!mounted) return;
      setSession(nextSession);

      if (!nextSession?.user) {
        setAuthChecking(false);
        return;
      }

      try {
        const cloudProfile = await loadCloudProfile(nextSession.user);
        const saved = loadState();
        // A local cache is safe to migrate only when it is guest data or already
        // belongs to this exact account. A different account's cache must never
        // be merged into the newly signed-in user.
        const canUseLocalForThisAccount = !saved.ownerId || saved.ownerId === nextSession.user.id;
        const localProgress = canUseLocalForThisAccount ? saved.dayScores : {};
        const localAttempts = canUseLocalForThisAccount ? saved.attemptHistory : {};
        const cloudProgress = await syncLocalProgress(nextSession.user.id, localProgress);
        const cloudAttempts = await loadQuizAttempts(nextSession.user.id);

        if (!mounted) return;

        if (cloudProfile && cloudProfile.name.trim() && cloudProfile.age.trim()) {
          // A newly-created account stores its complete profile in Auth metadata.
          // Upsert the same data into public.profiles so future logins can load it
          // without asking for name/age/language again.
          await saveCloudProfile(nextSession.user.id, cloudProfile);
          if (!mounted) return;
          setUser(cloudProfile);
          setLang(cloudProfile.language);
          setDayScores(cloudProgress);
          const serverHistory: Record<number, LocalQuizAttempt[]> = {};
          for (const attempt of cloudAttempts) {
            const dayIndex = attempt.day - 1;
            const localDayAttempts = localAttempts[dayIndex] ?? [];
            const localMatch = localDayAttempts.find((item) => item.attemptNumber === attempt.attemptNumber);
            if (localMatch) {
              (serverHistory[dayIndex] ??= []).push(localMatch);
            } else {
              (serverHistory[dayIndex] ??= []).push({
                id: `cloud-${attempt.id}`,
                day: dayIndex,
                attemptNumber: attempt.attemptNumber,
                score: attempt.score,
                totalQuestions: attempt.totalQuestions,
                completedAt: attempt.completedAt,
                answers: [],
              });
            }
          }
          for (const [day, items] of Object.entries(localAttempts)) {
            const dayIndex = Number(day);
            if (!serverHistory[dayIndex]) serverHistory[dayIndex] = items;
          }
          setAttemptHistory(serverHistory);
          saveState({ user: cloudProfile, dayScores: cloudProgress, attemptHistory: serverHistory, ownerId: nextSession.user.id });
          setScreen('main');
        } else {
          const metadata = nextSession.user.user_metadata ?? {};
          const metadataName = typeof metadata.name === 'string' ? metadata.name : '';
          const metadataAge = typeof metadata.age === 'number' ? String(metadata.age) : typeof metadata.age === 'string' ? metadata.age : '';
          const metadataLanguage = metadata.language === 'hi' || metadata.language === 'mr' ? metadata.language : 'en';
          setUser((prev) => ({
            ...prev,
            name: metadataName.trim() || prev.name,
            age: metadataAge || prev.age,
            language: metadataLanguage as Language,
          }));
          setLang(metadataLanguage as Language);
          setScreen('info');
        }
      } catch (error) {
        console.error('Unable to load cloud account data:', error);
        if (mounted) setScreen('info');
      } finally {
        if (mounted) setAuthChecking(false);
      }
    }

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session ?? null));

    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, nextSession: Session | null) => {
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setTab('home');
        setActiveDay(null);
        setScreen('auth');
        setAuthChecking(false);
        return;
      }
      void hydrate(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  function chooseLanguage(next: Language) {
    setLang(next);
    setUser((prev) => ({ ...prev, language: next }));
    setScreen('info');
  }

  function submitUser() {
    if (!user.name.trim() || !user.age.trim()) {
      setFormErr(L.fill);
      return;
    }
    const age = Number(user.age);
    if (!Number.isFinite(age) || age < 5 || age > 120) {
      setFormErr('Please enter a valid age.');
      return;
    }
    setFormErr('');
    setScreen('main');
    setTab('home');

    if (session?.user) {
      void saveCloudProfile(session.user.id, user).catch((error) => {
        console.error('Unable to save profile:', error);
      });
    }
  }

  function startDay(day: number) {
    if (!isDayUnlocked(day, dayScores)) return;
    setActiveDay(day);
    setCur(0);
    setSel(null);
    setAnswers([]);
    setShowTrivia(false);
    setSelectedAttempt(null);
    setQuizDone(false);
    setQuizStartedAt(new Date().toISOString());
    setScreen('quiz');
  }

  function handleSel(idx: number) {
    if (sel !== null || !q) return;
    const correct = idx === q.ans;
    const answer: AnswerRecord = {
      correct,
      trivia: q.trivia,
      q: q.q,
      ans: q.opts[q.ans],
      selected: q.opts[idx],
    };
    setSel(idx);
    setAnswers((prev) => [...prev, answer]);
    setShowTrivia(true);
  }

  function handleNext() {
    if (!q || activeDay === null || sel === null) return;

    if (cur + 1 < total) {
      setShowTrivia(false);
      setSel(null);
      setCur((c) => c + 1);
      return;
    }

    // React state updates are asynchronous. `answers` may not yet contain
    // the final answer, so include it explicitly before calculating the score.
    const finalAnswer: AnswerRecord = {
      correct: sel === q.ans,
      trivia: q.trivia,
      q: q.q,
      ans: q.opts[q.ans],
      selected: q.opts[sel],
    };
    const finalAnswers = answers.length === total ? answers : [...answers, finalAnswer];
    const correctCount = finalAnswers.filter((answer) => answer.correct).length;
    const score = total > 0 ? Math.round((correctCount / total) * 10) : 0;

    const completedAt = istDateString();
    setAnswers(finalAnswers);
    const nextProgress: DayProgress = {
      score,
      completedAt,
      firstCompletedAt: dayScores[activeDay]?.firstCompletedAt ?? completedAt,
      answers: finalAnswers,
    };

    const localAttempt: LocalQuizAttempt = {
      id: `local-${Date.now()}-${activeDay}`,
      day: activeDay,
      attemptNumber: (attemptHistory[activeDay]?.length ?? 0) + 1,
      score,
      totalQuestions: total,
      completedAt,
      startedAt: quizStartedAt ?? completedAt,
      answers: finalAnswers,
    };

    setDayScores((prev) => ({
      ...prev,
      [activeDay]: nextProgress,
    }));
    setAttemptHistory((prev) => ({
      ...prev,
      [activeDay]: [...(prev[activeDay] ?? []), localAttempt],
    }));

    if (session?.user) {
      void recordQuizAttempt({
        userId: session.user.id,
        dayIndex: activeDay,
        score,
        totalQuestions: total,
        startedAt: quizStartedAt ?? completedAt,
        answers: finalAnswers,
      }).then((cloudProgress) => {
        setDayScores((prev) => ({
          ...prev,
          [activeDay]: { ...cloudProgress, answers: finalAnswers },
        }));
        void loadQuizAttempts(session.user.id, activeDay).then((attempts) => {
          setReviewAttempts(attempts);
        }).catch((error) => console.error('Unable to refresh attempt history:', error));
      }).catch((error) => {
        console.error('Unable to sync quiz attempt:', error);
      });
    }

    setQuizDone(true);
    setQuizStartedAt(null);
  }

  function resetToLanguage() {
    clearState();
    setLang(null);
    setUser({ name: '', age: '', language: 'en' });
    setDayScores({});
    setAttemptHistory({});
    setReviewAttempts([]);
    setSelectedAttempt(null);
    setActiveDay(null);
    setScreen('lang');
  }

  async function handleSignOut() {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      // Remove account-local cache so the next account on this browser cannot
      // accidentally inherit the previous user's progress. Cloud progress remains
      // محفوظ in Supabase and will be reloaded on the next sign-in.
      clearState();
      setSession(null);
      setTab('home');
      setActiveDay(null);
      setDayScores({});
      setAttemptHistory({});
      setReviewAttempts([]);
      setSelectedAttempt(null);
      setUser({ name: '', age: '', language: 'en' });
      setLang(null);
      setScreen('auth');
    }
  }

  async function openDayReview(dayIndex: number) {
    setActiveDay(dayIndex);
    setScreen('review');
    setTab('profile');
    setSelectedAttempt(null);
    setReviewLoading(true);

    try {
      if (session?.user) {
        const attempts = await loadQuizAttempts(session.user.id, dayIndex);
        setReviewAttempts(attempts);
        if (attempts[0]) {
          const details = await loadQuizAttemptDetails(session.user.id, attempts[0].id);
          setSelectedAttempt(details);
        }
      } else {
        const local = [...(attemptHistory[dayIndex] ?? [])].sort((a, b) => b.attemptNumber - a.attemptNumber);
        const summaries: QuizAttemptSummary[] = local.map((attempt) => ({
          id: attempt.id,
          day: dayIndex + 1,
          attemptNumber: attempt.attemptNumber,
          score: attempt.score,
          totalQuestions: attempt.totalQuestions,
          percentage: attempt.totalQuestions ? Math.round((attempt.score / 10) * 100) : 0,
          startedAt: attempt.startedAt ?? null,
          completedAt: attempt.completedAt,
        }));
        setReviewAttempts(summaries);
        const latest = local[0];
        if (latest) {
          setSelectedAttempt({
            id: latest.id,
            day: dayIndex + 1,
            attemptNumber: latest.attemptNumber,
            score: latest.score,
            totalQuestions: latest.totalQuestions,
            percentage: latest.totalQuestions ? Math.round((latest.score / 10) * 100) : 0,
            startedAt: latest.startedAt ?? null,
            completedAt: latest.completedAt,
            answers: latest.answers.map((answer, index) => ({
              id: `${latest.id}-${index + 1}`,
              attemptId: latest.id,
              questionNumber: index + 1,
              questionText: answer.q,
              selectedText: answer.selected,
              correctText: answer.ans,
              isCorrect: answer.correct,
              explanation: answer.trivia,
            })),
          });
        }
      }
    } catch (error) {
      console.error('Unable to load review history:', error);
    } finally {
      setReviewLoading(false);
    }
  }

  async function selectAttempt(attemptId: string) {
    if (!session?.user || !attemptId || attemptId.startsWith('local-')) return;
    setReviewLoading(true);
    try {
      const details = await loadQuizAttemptDetails(session.user.id, attemptId);
      setSelectedAttempt(details);
    } catch (error) {
      console.error('Unable to load attempt:', error);
    } finally {
      setReviewLoading(false);
    }
  }

  const totalScore = Object.values(dayScores).reduce((sum, item) => sum + item.score, 0);
  const completedDays = Object.keys(dayScores).length;
  const avgScore = completedDays ? Math.round(totalScore / completedDays) : 0;

  const progressLabel = useMemo(() => {
    if (activeDay === null || !q) return '';
    return `${cur + 1} / ${total}`;
  }, [activeDay, cur, q, total]);

  const wrapStyle = { '--accent': COLORS.saffron, '--gold': COLORS.gold } as CSSProperties;

  if (authChecking) {
    return (
      <div className="app-shell" style={wrapStyle}>
        <div className="page-card centered-card">
          <div className="om">🕉️</div>
          <div className="section-title">Path of Dharma</div>
          <div className="muted">Checking your session…</div>
        </div>
      </div>
    );
  }

  if (screen === 'auth') {
    return <AuthScreen onGuest={() => setScreen(initialSaved.user ? 'main' : 'lang')} />;
  }

  if (screen === 'lang') {
    return (
      <div className="app-shell" style={wrapStyle}>
        <div className="page-card centered-card">
          <div className="om">🕉️</div>
          <div className="hero-title">Path of Dharma</div>
          <div className="muted">धर्माचा मार्ग · धर्म का मार्ग</div>
          <div className="language-heading">Choose Language · भाषा चुनें · भाषा निवडा</div>
          {([['en', 'English'], ['hi', 'हिंदी'], ['mr', 'मराठी']] as const).map(([code, label]) => (
            <button key={code} className="outline-btn large" onClick={() => chooseLanguage(code)}>{label}</button>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'info') {
    return (
      <div className="app-shell" style={wrapStyle}>
        <div className="page-card">
          <div className="center-heading">
            <div className="om small">🕉️</div>
            <div className="section-title">{L.appTitle}</div>
            <div className="muted small-text">{L.appSub}</div>
          </div>
          <label className="field-label">{L.name}</label>
          <input className="field-input" value={user.name} onChange={(e) => setUser((u) => ({ ...u, name: e.target.value }))} />
          <label className="field-label">{L.age}</label>
          <input className="field-input" type="number" min={5} max={120} value={user.age} onChange={(e) => setUser((u) => ({ ...u, age: e.target.value }))} />
          {formErr && <div className="error-text">{formErr}</div>}
          <button className="primary-btn" onClick={submitUser}>{L.start}</button>
          <button className="link-btn" onClick={() => setScreen('lang')}>← {L.choose}</button>
        </div>
      </div>
    );
  }

  if (screen === 'quiz' && activeDay !== null && q) {
    const progress = Math.round(((cur + 1) / total) * 100);

    if (quizDone) {
      const ds = dayScores[activeDay]?.score ?? 0;
      const pct = ds * 10;
      const age = Number.parseInt(user.age, 10) || 25;

      return (
        <div className="app-shell">
          <div className="page-card">
            <div className="center-heading">
              <div className="section-title">{L.days[activeDay]}</div>
              <div className="muted small-text">{L.levelLabel}</div>
              <div className="score-number">{ds}<span>/10</span></div>
              <div className="score-pill">{pct >= 90 ? 'Exceptional 🌟' : pct >= 70 ? 'Well Done 👏' : pct >= 50 ? 'Good Start 🙏' : 'Keep Going 💪'}</div>
              <div className="score-note">{L.scoreNote(pct)}</div>
              <div className="age-note"><strong>🙏 {user.name}</strong><br />{L.ageNote(age)}</div>
            </div>

            <div className="review-title">{L.review}</div>
            {answers.map((a, i) => (
              <div className="review-row" key={`${a.q}-${i}`}>
                <span className={a.correct ? 'review-mark correct' : 'review-mark incorrect'}>{a.correct ? '✓' : '✗'}</span>
                <div>
                  <div className="review-question">{a.q}</div>
                  {!a.correct && <div className="correct-answer">Correct: {a.ans}</div>}
                  <div className="review-trivia">{a.trivia.slice(0, 120)}…</div>
                </div>
              </div>
            ))}

            {activeDay < 6 && (
              <div className="notice">🌅 {L.days[activeDay + 1]} unlocks at 6:00 AM IST tomorrow.</div>
            )}
            {activeDay === 6 && (
              <div className="completion-notice">
                <div className="trophy">🏆</div>
                <strong>Ārambhaka Level Complete!</strong><br />
                You have completed all 7 days of the foundational level. Your journey to Jijnāsu begins next.
              </div>
            )}

            {isDayUnlocked(activeDay, dayScores) ? (
              <button className="primary-btn" onClick={() => startDay(activeDay)}>{L.retry}</button>
            ) : (
              <div className="notice">🔒 Retest available after 6:00 AM IST tomorrow.</div>
            )}
            {activeDay < 6 && isDayUnlocked(activeDay + 1, dayScores) && (
              <button className="gold-btn" onClick={() => startDay(activeDay + 1)}>{L.nextDay}</button>
            )}
            <button className="secondary-btn" onClick={() => { setScreen('main'); setTab('home'); setActiveDay(null); }}>{'← Back to Home'}</button>
            <Footer text={L.createdBy} />
          </div>
        </div>
      );
    }

    return (
      <div className="app-shell">
        <div className="quiz-header">
          <span className="muted">{L.days[activeDay]}</span>
          <span className="question-count">{L.question} {progressLabel}</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>

        <div className="quiz-card">
          <div className="quiz-image-wrap">
            <img src={BG_IMAGES[q.img]} alt="" className="quiz-image" onError={(e) => { e.currentTarget.hidden = true; }} />
            <div className="quiz-overlay" />
            <div className="quiz-om">ॐ</div>
            <div className="quiz-question">{q.q}</div>
          </div>
          <div className="quiz-body">
            {q.opts.map((opt, idx) => {
              let className = 'answer-btn';
              if (sel !== null) {
                if (idx === q.ans) className += ' answer-correct';
                else if (idx === sel) className += ' answer-wrong';
                else className += ' answer-disabled';
              }
              return (
                <button key={opt} disabled={sel !== null} onClick={() => handleSel(idx)} className={className}>
                  <span className="option-letter">{String.fromCharCode(65 + idx)}.</span>{opt}
                </button>
              );
            })}

            {showTrivia && (
              <div className="trivia-box">
                <div className="trivia-heading">{sel === q.ans ? L.correct : L.wrong}</div>
                <div className="trivia-text">{q.trivia}</div>
              </div>
            )}

            {showTrivia && <button className="primary-btn" onClick={handleNext}>{cur + 1 < total ? L.next : L.results}</button>}
          </div>
        </div>
        <button className="back-btn" onClick={() => { setScreen('main'); setActiveDay(null); }}>← Back</button>
      </div>
    );
  }

  if (screen === 'review' && activeDay !== null) {
    const ds = dayScores[activeDay];
    const selectedAnswers = selectedAttempt?.answers ?? [];

    return (
      <div className="app-shell">
        <div className="page-card">
          <div className="center-heading">
            <div className="section-title">{L.days[activeDay]} — Test History</div>
            <div className="muted small-text">Review your previous attempts and every answer.</div>
          </div>

          <div className="attempt-list">
            {reviewAttempts.length === 0 && !reviewLoading && (
              <div className="muted">No saved test attempts are available for this day.</div>
            )}
            {reviewAttempts.map((attempt) => {
              const active = selectedAttempt?.id === attempt.id && selectedAttempt?.attemptNumber === attempt.attemptNumber;
              return (
                <button
                  type="button"
                  key={`${attempt.id}-${attempt.attemptNumber}`}
                  className={`attempt-row ${active ? 'active' : ''}`}
                  onClick={() => !attempt.id.startsWith('local-') ? void selectAttempt(attempt.id) : setSelectedAttempt({
                    id: attempt.id, day: attempt.day, attemptNumber: attempt.attemptNumber, score: attempt.score, totalQuestions: attempt.totalQuestions, percentage: attempt.percentage, startedAt: attempt.startedAt ?? null, completedAt: attempt.completedAt,
                    answers: (attemptHistory[activeDay]?.find((item) => item.attemptNumber === attempt.attemptNumber)?.answers ?? []).map((answer, index) => ({ id: `${attempt.id}-${index + 1}`, attemptId: attempt.id, questionNumber: index + 1, questionText: answer.q, selectedText: answer.selected, correctText: answer.ans, isCorrect: answer.correct, explanation: answer.trivia }))
                  })}
                >
                  <span>Attempt #{attempt.attemptNumber}</span>
                  <strong>{attempt.score}/{attempt.totalQuestions || 10}</strong>
                  <span>{new Date(attempt.completedAt).toLocaleString()}</span>
                </button>
              );
            })}
          </div>

          {reviewLoading && <div className="muted">Loading attempt…</div>}

          {selectedAttempt && (
            <>
              <div className="review-summary">
                <div><span className="muted small-text">Score</span><strong>{selectedAttempt.score}/{selectedAttempt.totalQuestions}</strong></div>
                <div><span className="muted small-text">Accuracy</span><strong>{selectedAttempt.percentage}%</strong></div>
                <div><span className="muted small-text">Completed</span><strong>{new Date(selectedAttempt.completedAt).toLocaleString()}</strong></div>
              </div>

              <div className="review-title">Question-by-question review</div>
              {selectedAnswers.length === 0 && (
                <div className="notice">This attempt is older than the detailed review feature, so its score is available but its individual answers were not stored.</div>
              )}
              {selectedAnswers.map((answer) => (
                <div className="review-row" key={`${answer.attemptId}-${answer.questionNumber}`}>
                  <span className={answer.isCorrect ? 'review-mark correct' : 'review-mark incorrect'}>{answer.isCorrect ? '✓' : '✗'}</span>
                  <div>
                    <div className="review-question">Q{answer.questionNumber}. {answer.questionText}</div>
                    <div className="review-trivia">Your answer: {answer.selectedText}</div>
                    {!answer.isCorrect && <div className="correct-answer">Correct: {answer.correctText}</div>}
                    <div className="review-trivia">{answer.explanation}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!selectedAttempt && ds?.answers && ds.answers.length > 0 && (
            <div className="notice">Your latest local review is available after selecting an attempt.</div>
          )}

          <button className="secondary-btn" onClick={() => { setScreen('main'); setTab('profile'); setActiveDay(null); }}>{'← Back'}</button>
          <Footer text={L.createdBy} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell main-shell">
      {tab === 'home' && (
        <HomeTab L={L} user={user} dayScores={dayScores} onStart={startDay} />
      )}
      {tab === 'profile' && (
        <ProfileTab L={L} user={user} dayScores={dayScores} totalScore={totalScore} avgScore={avgScore} isSignedIn={Boolean(session)} onReset={resetToLanguage} onSignOut={handleSignOut} onViewDay={(i: number) => { void openDayReview(i); }} />
      )}
      {tab === 'journey' && <JourneyTab L={L} />}

      <div className="tab-bar">
        {([['home', '🏠', L.home], ['profile', '👤', L.profile], ['journey', '📿', L.levels]] as const).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'tab active' : 'tab'} onClick={() => setTab(key)}>
            <div className="tab-icon">{icon}</div>
            <div>{label}</div>
          </button>
        ))}
      </div>
      <div className="auth-area" style={{ padding: '8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {session ? (
          <div className="signed-in" style={{ color: 'var(--accent)' }}>
            Signed in as {user.name || session?.user?.email || 'user'}
          </div>
        ) : (
          <button className="link-btn" onClick={() => setScreen('auth')}>Sign in</button>
        )}
      </div>
    </div>
  );
}

function HomeTab({ L, user, dayScores, onStart }: { L: (typeof LANGS)[Language]; user: UserProfile; dayScores: Record<number, DayProgress>; onStart: (day: number) => void }) {
  return (
    <div>
      <div className="page-card center-heading">
        <div className="om">🕉️</div>
        <div className="hero-title">{L.appTitle}</div>
        <div className="muted">{L.appSub}</div>
        <div className="welcome-box">🙏 {L.welcome(user.name)}</div>
        <div className="stats-grid">
          {[[String(7), 'Days Total'], ['142', 'Full Journey'], [String(Object.keys(dayScores).length), 'Days Done']].map(([value, label]) => (
            <div className="stat-card" key={label}><div className="stat-value">{value}</div><div className="stat-label">{label}</div></div>
          ))}
        </div>
      </div>

      <div className="page-card">
        <div className="card-heading">Ārambhaka — All 7 Days</div>
        {L.days.map((day, i) => {
          const done = dayScores[i] !== undefined;
          const unlocked = isDayUnlocked(i, dayScores);
          const locked = !done && !unlocked;
          return (
            <div className="day-row" key={day}>
              <div className={`day-circle ${done ? 'done' : locked ? 'locked' : ''}`}>{done ? '✓' : i + 1}</div>
              <div className="day-info">
                <div className={`day-name ${locked ? 'locked-text' : ''}`}>{day}</div>
                <div className="day-difficulty">{DAY_DIFFICULTY[i]}</div>
              </div>
              {done ? (
                isDayUnlocked(i, dayScores) ? (
                  <button className="start-btn" onClick={() => onStart(i)}>Retest</button>
                ) : (
                  <span className="day-score">{dayScores[i].score}/10 · 🔒</span>
                )
              ) : locked ? (
                <span className="lock">🔒</span>
              ) : (
                <button className="start-btn" onClick={() => onStart(i)}>Start</button>
              )}
            </div>
          );
        })}
      </div>
      <Footer text={L.createdBy} />
    </div>
  );
}

function ProfileTab({ L, user, dayScores, totalScore, avgScore, isSignedIn, onReset, onSignOut, onViewDay }: { L: (typeof LANGS)[Language]; user: UserProfile; dayScores: Record<number, DayProgress>; totalScore: number; avgScore: number; isSignedIn: boolean; onReset: () => void; onSignOut: () => Promise<void>; onViewDay: (i: number) => void }) {
  return (
    <div>
      <div className="page-card">
        <div className="profile-head">
          <div className="avatar">{user.name[0]?.toUpperCase() ?? '?'}</div>
          <div>
            <div className="profile-name">{user.name}</div>
            <div className="muted small-text">Ārambhaka · {Object.keys(dayScores).length} of 7 days</div>
            <div className="muted small-text">Age: {user.age}</div>
          </div>
        </div>
        <div className="stats-grid">
          {[[String(Object.keys(dayScores).length), 'Days Done'], [`${avgScore}/10`, 'Avg Score'], ['Ārambhaka', 'Level']].map(([value, label]) => (
            <div className="stat-card" key={label}><div className="stat-value compact">{value}</div><div className="stat-label">{label}</div></div>
          ))}
        </div>
      </div>

      <div className="page-card">
        <div className="card-heading">Score History</div>
        {Object.keys(dayScores).length === 0 && <div className="muted">No days completed yet. Start Day 1!</div>}
        {L.days.map((day, i) => dayScores[i] !== undefined && (
          <div className="history-row" key={day}>
            <div><div className="history-name">{day}</div><div className="muted small-text">Ārambhaka Level</div></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className={`history-score ${dayScores[i].score >= 7 ? 'green' : dayScores[i].score >= 5 ? 'orange' : 'red'}`}>{dayScores[i].score}<span>/10</span></div>
              <button className="link-btn" onClick={() => onViewDay(i)}>View</button>
            </div>
          </div>
        ))}
      </div>

      <div className="page-card">
        <div className="card-heading">Badges</div>
        <div className="badge-grid">
          {L.days.map((day, i) => (
            <div className={`badge ${dayScores[i] === undefined ? 'dimmed' : ''}`} key={day}>
              <div className="badge-icon">{BADGE_ICONS[i]}</div>
              <div>Day {i + 1}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="page-card">
        <div className="card-heading">Progress & account</div>
        <div className="muted">Guest progress is stored locally. When you are signed in, your profile and quiz scores are synchronized with your Supabase account.</div>
        <div className="muted small-text spacer">Total points recorded: {totalScore}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="danger-btn" onClick={onReset}>Reset Local Progress</button>
          {isSignedIn && <button className="secondary-btn" onClick={onSignOut}>Sign out</button>}
        </div>
      </div>
      <Footer text={L.createdBy} />
    </div>
  );
}

function JourneyTab({ L }: { L: (typeof LANGS)[Language] }) {
  return (
    <div>
      <div className="journey-title">Your 142-Day Journey</div>
      {LEVELS.map((level, i) => {
        const startDay = LEVEL_START_DAYS[i];
        const endDay = startDay + level.days - 1;
        return (
          <div key={level.name} className="level-card" style={{ borderLeftColor: level.color, background: level.bg }}>
            <div className="level-main">
              <div className="level-name-row"><span className="level-emoji">{level.emoji}</span><span className="level-name">{level.name}</span><span className="level-sanskrit" style={{ color: level.color }}>{level.san}</span></div>
              <div className="level-desc">{level.desc}</div>
              <div className="level-meta">Days {startDay}–{endDay} · {level.days} days · Exam + Badge after completion</div>
            </div>
            <div className="level-count"><strong style={{ color: level.color }}>{level.days}</strong><span>days</span></div>
          </div>
        );
      })}
      <div className="level-card final-level">
        <div>
          <div className="level-name">🏆 Final Completion — Day 142</div>
          <div className="level-desc">A special appreciation ceremony and certificate for completing the full 142-day, 7-level journey through Hindu Dharma.</div>
        </div>
      </div>
      <Footer text={L.createdBy} />
    </div>
  );
}

export default App;
