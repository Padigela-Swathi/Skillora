// Mirrors the Supabase schema (generated with `generate_typescript_types` on 2026-11-20; regenerate with `supabase gen types typescript`).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = never, Update = never> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type ProfileRow = {
  id: string; full_name: string; college: string; branch: string | null; year_of_study: string | null;
  gender: string | null; age: number | null; terms_version: string | null; terms_accepted_at: string | null;
  created_at: string; updated_at: string;
}
export type InterviewRow = {
  id: string; user_id: string; round: string; level: string; duration_min: number; question_count: number;
  status: string; ended_early: boolean; answered_count: number; skipped_count: number; score: number | null;
  sub_scores: Json | null; strengths: Json | null; weaknesses: Json | null; tips: Json | null; error_message: string | null;
  created_at: string; started_at: string | null; ended_at: string | null; evaluated_at: string | null;
}
export type QuestionRow = {
  id: string; interview_id: string; user_id: string; position: number; kind: string; question_text: string; topic: string | null;
  coding: Json | null; status: string; transcript: string | null; code_language: string | null; code_source: string | null;
  last_run: Json | null; score: number | null; went_well: string | null; to_improve: string | null; stronger_answer: string | null;
  answered_at: string | null; created_at: string;
}
export type RatingRow = { id: string; interview_id: string; user_id: string; stars: number; comment: string | null; created_at: string };

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, never, Partial<Pick<ProfileRow, "full_name" | "college" | "branch" | "year_of_study" | "gender" | "age">>>;
      interviews: Table<InterviewRow>;
      interview_questions: Table<QuestionRow>;
      feedback_ratings: Table<RatingRow, { interview_id: string; user_id: string; stars: number; comment?: string | null }>;
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_terms: { Args: { p_version: string }; Returns: undefined };
      admin_reach_stats: { Args: Record<string, never>; Returns: Json };
      daily_usage: { Args: Record<string, never>; Returns: Json };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      finish_interview: { Args: { p_interview_id: string; p_quit?: boolean }; Returns: Json };
      rating_due: { Args: { p_interview_id: string }; Returns: boolean };
      submit_answer: { Args: { p_question_id: string; p_action: string; p_transcript?: string; p_code_language?: string; p_code_source?: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
