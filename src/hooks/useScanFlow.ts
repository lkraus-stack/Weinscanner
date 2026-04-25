import { useReducer } from 'react';

import type { UploadResult } from '@/lib/storage';

export type ScanStatus =
  | 'idle'
  | 'reviewing'
  | 'cropping'
  | 'uploading'
  | 'success'
  | 'error';

type ScanFlowState = {
  status: ScanStatus;
  uri: string | null;
  error: string | null;
  uploadResult: UploadResult | null;
};

type ScanFlowAction =
  | { type: 'set_uri'; uri: string }
  | { type: 'start_cropping' }
  | { type: 'start_upload' }
  | { type: 'complete_upload'; uploadResult: UploadResult }
  | { type: 'fail_upload'; error: string }
  | { type: 'retake' }
  | { type: 'reset' };

function reducer(state: ScanFlowState, action: ScanFlowAction): ScanFlowState {
  switch (action.type) {
    case 'set_uri':
      return {
        ...state,
        error: null,
        status: 'reviewing',
        uri: action.uri,
      };
    case 'start_cropping':
      return {
        ...state,
        error: null,
        status: 'cropping',
      };
    case 'start_upload':
      return {
        ...state,
        error: null,
        status: 'uploading',
        uploadResult: null,
      };
    case 'complete_upload':
      return {
        ...state,
        error: null,
        status: 'success',
        uploadResult: action.uploadResult,
      };
    case 'fail_upload':
      return {
        ...state,
        error: action.error,
        status: 'error',
      };
    case 'retake':
      return {
        error: null,
        status: 'idle',
        uploadResult: null,
        uri: null,
      };
    case 'reset':
      return {
        error: null,
        status: state.uri ? 'reviewing' : 'idle',
        uploadResult: null,
        uri: state.uri,
      };
    default:
      return state;
  }
}

export function useScanFlow(initialUri?: string) {
  const [state, dispatch] = useReducer(reducer, {
    error: null,
    status: initialUri ? 'reviewing' : 'idle',
    uploadResult: null,
    uri: initialUri ?? null,
  });

  return {
    state,
    setUri: (uri: string) => dispatch({ type: 'set_uri', uri }),
    startCropping: () => dispatch({ type: 'start_cropping' }),
    startUpload: () => dispatch({ type: 'start_upload' }),
    completeUpload: (uploadResult: UploadResult) =>
      dispatch({ type: 'complete_upload', uploadResult }),
    failUpload: (error: string) => dispatch({ type: 'fail_upload', error }),
    retake: () => dispatch({ type: 'retake' }),
    reset: () => dispatch({ type: 'reset' }),
  };
}
