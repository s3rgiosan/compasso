type SessionExpiredHandler = () => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler): void {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired(): void {
  if (sessionExpiredHandler) {
    sessionExpiredHandler();
  }
}
