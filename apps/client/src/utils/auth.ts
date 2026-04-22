export function sanitizeNextPath(value: string | null | undefined) {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return "/";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function buildLoginPath(nextPath: string) {
  const safeNext = sanitizeNextPath(nextPath);
  if (safeNext === "/") {
    return "/auth/login";
  }
  return `/auth/login?next=${encodeURIComponent(safeNext)}`;
}

export function getAuthErrorText(errorCode: string | null) {
  switch (errorCode) {
    case "provider_unavailable":
      return "Этот провайдер входа сейчас недоступен.";
    case "access_denied":
      return "Вход через провайдера был отменен.";
    case "invalid_request":
      return "Некорректный запрос авторизации.";
    case "invalid_state":
      return "Сессия входа истекла. Попробуйте начать вход заново.";
    case "provider_error":
      return "Не удалось завершить вход через провайдера.";
    case "missing_email":
      return "Провайдер не вернул email, поэтому вход не может быть завершен.";
    case "email_not_verified":
      return "Для входа требуется подтвержденный email у провайдера.";
    case "identity_conflict":
      return "Обнаружен конфликт привязки учетной записи. Вход отклонен.";
    case "blocked":
      return "Учетная запись заблокирована.";
    default:
      return null;
  }
}
