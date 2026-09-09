export interface JwtPayload {
  type: 'access' | 'refresh';
  id: number;
  role: string;
}
