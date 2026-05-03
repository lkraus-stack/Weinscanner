import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePreferences } from '@/hooks/usePreferences';
import { trackAdoptionEvent } from '@/lib/analytics';
import {
  AGE_GATE_VERSION,
  AI_CONSENT_VERSION,
  type AgeGatePreferences,
  type AiConsentPreferences,
} from '@/lib/profile';
import { useToastStore } from '@/stores/toast-store';

type AiComplianceStep = 'age' | 'ai' | null;
type PendingAiAction = (() => void | Promise<void>) | null;

const CURRENT_PROVIDER_SCOPE: AiConsentPreferences['provider_scope'] =
  'vantero_google';

function createAgeGate(): AgeGatePreferences {
  return {
    confirmed_at: new Date().toISOString(),
    minimum_age: 18,
    version: AGE_GATE_VERSION,
  };
}

function createAiConsent(): AiConsentPreferences {
  return {
    accepted_at: new Date().toISOString(),
    provider_scope: CURRENT_PROVIDER_SCOPE,
    version: AI_CONSENT_VERSION,
  };
}

export function useAiComplianceGate() {
  const preferencesQuery = usePreferences();
  const showToast = useToastStore((state) => state.showToast);
  const [requiredStep, setRequiredStep] = useState<AiComplianceStep>(null);
  const [pendingAction, setPendingAction] = useState<PendingAiAction>(null);
  const preferences = preferencesQuery.preferences;

  const hasConfirmedAgeGate = Boolean(
    preferences.age_gate.confirmed_at &&
      preferences.age_gate.minimum_age === 18 &&
      preferences.age_gate.version === AGE_GATE_VERSION
  );
  const hasAcceptedAiConsent = Boolean(
    preferences.ai_consent.accepted_at &&
      preferences.ai_consent.provider_scope === CURRENT_PROVIDER_SCOPE &&
      preferences.ai_consent.version === AI_CONSENT_VERSION
  );
  const canUseAiFeatures = hasConfirmedAgeGate && hasAcceptedAiConsent;

  useEffect(() => {
    if (requiredStep === 'age') {
      trackAdoptionEvent('age_gate_shown', { feature: 'compliance' });
    } else if (requiredStep === 'ai') {
      trackAdoptionEvent('ai_consent_shown', { feature: 'compliance' });
    }
  }, [requiredStep]);

  const runPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);

    if (action) {
      void Promise.resolve(action()).catch(() => undefined);
    }
  }, [pendingAction]);

  const cancelGate = useCallback(() => {
    if (requiredStep === 'age') {
      trackAdoptionEvent('age_gate_failed', { feature: 'compliance' });
    } else if (requiredStep === 'ai') {
      trackAdoptionEvent('ai_consent_declined', { feature: 'compliance' });
    }

    setRequiredStep(null);
    setPendingAction(null);
  }, [requiredStep]);

  const requestAiAccess = useCallback(
    (action?: () => void | Promise<void>) => {
      setPendingAction(() => action ?? null);

      if (preferencesQuery.isLoading) {
        return false;
      }

      if (!hasConfirmedAgeGate) {
        setRequiredStep('age');
        return false;
      }

      if (!hasAcceptedAiConsent) {
        setRequiredStep('ai');
        return false;
      }

      setPendingAction(null);
      if (action) {
        void Promise.resolve(action()).catch(() => undefined);
      }
      return true;
    },
    [
      hasAcceptedAiConsent,
      hasConfirmedAgeGate,
      preferencesQuery.isLoading,
    ]
  );

  const confirmAgeGate = useCallback(async () => {
    try {
      await preferencesQuery.updatePreference('age_gate', createAgeGate());
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Altersfreigabe konnte nicht gespeichert werden.'
      );
      return;
    }

    trackAdoptionEvent('age_gate_passed', { feature: 'compliance' });

    if (!hasAcceptedAiConsent) {
      setRequiredStep('ai');
      return;
    }

    setRequiredStep(null);
    runPendingAction();
  }, [hasAcceptedAiConsent, preferencesQuery, runPendingAction, showToast]);

  const acceptAiConsent = useCallback(async () => {
    try {
      await preferencesQuery.updatePreference('ai_consent', createAiConsent());
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'KI-Freigabe konnte nicht gespeichert werden.'
      );
      return;
    }

    trackAdoptionEvent('ai_consent_accepted', { feature: 'compliance' });

    setRequiredStep(null);
    runPendingAction();
  }, [preferencesQuery, runPendingAction, showToast]);

  const modalProps = useMemo(
    () => ({
      ageGate: {
        isOpen: requiredStep === 'age',
        isSaving: preferencesQuery.isUpdatingPreference,
        onAccept: () => void confirmAgeGate(),
        onDecline: cancelGate,
      },
      aiConsent: {
        isOpen: requiredStep === 'ai',
        isSaving: preferencesQuery.isUpdatingPreference,
        onAccept: () => void acceptAiConsent(),
        onDecline: cancelGate,
      },
    }),
    [
      acceptAiConsent,
      cancelGate,
      confirmAgeGate,
      preferencesQuery.isUpdatingPreference,
      requiredStep,
    ]
  );

  return {
    canUseAiFeatures,
    hasAcceptedAiConsent,
    hasConfirmedAgeGate,
    isCheckingCompliance: preferencesQuery.isLoading,
    modalProps,
    requestAiAccess,
  };
}
