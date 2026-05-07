ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles SET funcao = 'Gestor' WHERE id = '53bf8edc-cf68-4cfb-9829-32988d9f1b0a';
ALTER TABLE public.profiles ENABLE TRIGGER USER;

INSERT INTO public.user_roles (user_id, role)
VALUES ('53bf8edc-cf68-4cfb-9829-32988d9f1b0a', 'Gestor')
ON CONFLICT (user_id, role) DO NOTHING;

DELETE FROM public.user_roles
WHERE user_id = '53bf8edc-cf68-4cfb-9829-32988d9f1b0a' AND role <> 'Gestor';