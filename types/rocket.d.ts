export interface PartBase { id: string; type: string; color: string }
export interface Nose extends PartBase { type: "nose"; shape:"ogive"|"conical"; length:number; baseØ:number }
export interface Body extends PartBase { type: "body"; Ø:number; length:number }
export interface Fin  extends PartBase { type: "fin"; root:number; span:number; sweep:number }
export type Part = Nose | Body | Fin;

export interface Rocket {
  id: string; name: string; parts: Part[];
  motorId: string; Cd: number; units:"metric"|"imperial";
} 