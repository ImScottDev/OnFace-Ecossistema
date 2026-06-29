import { NextResponse } from "next/server";

export function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details !== undefined && { details }) },
    { status }
  );
}

export function unauthorizedResponse(message = "Não autorizado") {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message = "Sem permissão") {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = "Não encontrado") {
  return errorResponse(message, 404);
}

export function badRequestResponse(message: string, details?: unknown) {
  return errorResponse(message, 400, details);
}
