export type AuthErrorCode =
  | "provider_unavailable"
  | "access_denied"
  | "invalid_request"
  | "invalid_state"
  | "provider_error"
  | "missing_email"
  | "email_not_verified"
  | "identity_conflict"
  | "blocked"
  | "unauthorized"
  | "invalid_display_name"
  | "invalid_avatar"
  | "not_found";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  provider_unavailable: "Провайдер авторизации недоступен",
  access_denied: "Вход через провайдера был отменен",
  invalid_request: "Некорректный запрос авторизации",
  invalid_state: "Сессия входа истекла или недействительна",
  provider_error: "Не удалось завершить вход через провайдера",
  missing_email: "Провайдер не вернул email пользователя",
  email_not_verified: "Email провайдера не подтвержден",
  identity_conflict: "Конфликт учетных данных провайдера",
  blocked: "Учетная запись заблокирована",
  unauthorized: "Требуется авторизация",
  invalid_display_name: "displayName должен быть длиной от 2 до 40 символов",
  invalid_avatar: "Некорректный формат аватара",
  not_found: "Ресурс не найден"
};

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  provider_unavailable: 404,
  access_denied: 400,
  invalid_request: 400,
  invalid_state: 400,
  provider_error: 502,
  missing_email: 400,
  email_not_verified: 400,
  identity_conflict: 409,
  blocked: 403,
  unauthorized: 401,
  invalid_display_name: 400,
  invalid_avatar: 400,
  not_found: 404
};

export class AuthError extends Error {
  code: AuthErrorCode;
  status: number;

  constructor(code: AuthErrorCode, message?: string) {
    super(message ?? AUTH_ERROR_MESSAGES[code]);
    this.code = code;
    this.status = AUTH_ERROR_STATUS[code];
  }
}

export function getAuthErrorMessage(code: AuthErrorCode) {
  return AUTH_ERROR_MESSAGES[code];
}
