--
-- PostgreSQL database dump
--

\restrict ChcmSARVOxZZiX5pPQ1MWXqfvzQT4jHQWLq6el9ZnpcexJV3txcDbqa5JPzQqXd

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.absences (
    id integer NOT NULL,
    teacher_id integer NOT NULL,
    day character varying(10) NOT NULL,
    date date,
    CONSTRAINT absences_day_check CHECK (((day)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying])::text[])))
);


ALTER TABLE public.absences OWNER TO postgres;

--
-- Name: absences_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.absences_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.absences_id_seq OWNER TO postgres;

--
-- Name: absences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.absences_id_seq OWNED BY public.absences.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(20) NOT NULL,
    curator_id integer
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: classroom_swaps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classroom_swaps (
    id integer NOT NULL,
    day character varying(10) NOT NULL,
    lesson_from integer NOT NULL,
    lesson_to integer NOT NULL,
    original_room_id integer NOT NULL,
    new_room_id integer NOT NULL,
    teacher_id integer,
    comment text,
    date date,
    CONSTRAINT classroom_swaps_day_check CHECK (((day)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying])::text[])))
);


ALTER TABLE public.classroom_swaps OWNER TO postgres;

--
-- Name: classroom_swaps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classroom_swaps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classroom_swaps_id_seq OWNER TO postgres;

--
-- Name: classroom_swaps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classroom_swaps_id_seq OWNED BY public.classroom_swaps.id;


--
-- Name: curators; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.curators (
    id integer NOT NULL,
    name character varying(255) NOT NULL
);


ALTER TABLE public.curators OWNER TO postgres;

--
-- Name: curators_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.curators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.curators_id_seq OWNER TO postgres;

--
-- Name: curators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.curators_id_seq OWNED BY public.curators.id;


--
-- Name: lessons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lessons (
    id integer NOT NULL,
    teacher_id integer NOT NULL,
    day character varying(10) NOT NULL,
    period integer NOT NULL,
    subject_id integer NOT NULL,
    class_id integer NOT NULL,
    room_id integer NOT NULL,
    CONSTRAINT lessons_day_check CHECK (((day)::text = ANY ((ARRAY['Monday'::character varying, 'Tuesday'::character varying, 'Wednesday'::character varying, 'Thursday'::character varying, 'Friday'::character varying])::text[])))
);


ALTER TABLE public.lessons OWNER TO postgres;

--
-- Name: lessons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.lessons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lessons_id_seq OWNER TO postgres;

--
-- Name: lessons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.lessons_id_seq OWNED BY public.lessons.id;


--
-- Name: replacements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.replacements (
    id integer NOT NULL,
    absence_id integer NOT NULL,
    period integer NOT NULL,
    replacement_teacher_id integer NOT NULL,
    comment text
);


ALTER TABLE public.replacements OWNER TO postgres;

--
-- Name: replacements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.replacements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.replacements_id_seq OWNER TO postgres;

--
-- Name: replacements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.replacements_id_seq OWNED BY public.replacements.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    name character varying(50) NOT NULL
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rooms_id_seq OWNER TO postgres;

--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_id_seq OWNER TO postgres;

--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: swap_classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.swap_classes (
    swap_id integer NOT NULL,
    class_id integer NOT NULL
);


ALTER TABLE public.swap_classes OWNER TO postgres;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teachers (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- Name: teachers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.teachers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.teachers_id_seq OWNER TO postgres;

--
-- Name: teachers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.teachers_id_seq OWNED BY public.teachers.id;


--
-- Name: absences id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences ALTER COLUMN id SET DEFAULT nextval('public.absences_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: classroom_swaps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classroom_swaps ALTER COLUMN id SET DEFAULT nextval('public.classroom_swaps_id_seq'::regclass);


--
-- Name: curators id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curators ALTER COLUMN id SET DEFAULT nextval('public.curators_id_seq'::regclass);


--
-- Name: lessons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons ALTER COLUMN id SET DEFAULT nextval('public.lessons_id_seq'::regclass);


--
-- Name: replacements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.replacements ALTER COLUMN id SET DEFAULT nextval('public.replacements_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: teachers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers ALTER COLUMN id SET DEFAULT nextval('public.teachers_id_seq'::regclass);


--
-- Data for Name: absences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.absences (id, teacher_id, day, date) FROM stdin;
1	21	Monday	\N
2	21	Wednesday	\N
3	21	Monday	\N
4	21	Monday	\N
5	21	Monday	\N
6	21	Monday	\N
7	28	Monday	\N
8	21	Monday	\N
9	21	Monday	\N
11	21	Monday	2026-07-07
12	3	Monday	2026-07-07
16	3	Monday	2026-07-08
17	21	Monday	2026-07-08
32	3	Monday	2026-07-06
33	21	Monday	2026-07-06
35	3	Monday	2026-07-13
36	3	Wednesday	2026-07-15
37	21	Wednesday	2026-07-15
38	15	Monday	2026-08-03
39	3	Monday	2026-08-03
40	15	Monday	2026-08-10
41	3	Monday	2026-08-10
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, name, curator_id) FROM stdin;
1	5Y7D	1
2	5Y7M	1
3	6Y8D	2
4	6Y8M	2
5	7Y9D	2
6	7Y9M	2
7	8Y10D	3
8	8Y10M	3
9	9Y11	3
10	10Y12	3
11	11Y13	3
\.


--
-- Data for Name: classroom_swaps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classroom_swaps (id, day, lesson_from, lesson_to, original_room_id, new_room_id, teacher_id, comment, date) FROM stdin;
2	Monday	1	2	7	9	18	123	2026-07-08
4	Monday	4	5	8	2	27		2026-07-08
5	Monday	5	6	15	4	33		2026-07-08
6	Monday	1	1	7	6	3		2026-07-08
7	Monday	1	1	7	6	15		2026-07-08
10	Monday	1	1	7	6	5		2026-07-06
11	Monday	1	1	2	8	19		2026-07-06
12	Monday	1	1	4	6	19		2026-07-06
16	Wednesday	5	5	2	13	13		2026-07-15
17	Monday	1	1	7	4	27		2026-08-10
\.


--
-- Data for Name: curators; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.curators (id, name) FROM stdin;
1	Иванова И.И.
2	Петров П.П.
3	Сидорова С.С.
\.


--
-- Data for Name: lessons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lessons (id, teacher_id, day, period, subject_id, class_id, room_id) FROM stdin;
1	21	Monday	1	17	11	7
2	21	Wednesday	2	30	3	7
3	21	Wednesday	2	30	4	7
4	21	Wednesday	3	30	3	7
5	21	Wednesday	3	30	4	7
10	15	Monday	1	1	3	13
11	15	Monday	1	1	4	13
12	15	Monday	2	1	3	13
13	15	Monday	2	1	4	13
14	3	Monday	1	1	3	12
15	3	Monday	1	1	4	12
16	3	Monday	2	1	3	12
17	3	Monday	2	1	4	12
18	25	Friday	1	32	1	9
19	25	Friday	1	32	2	9
20	25	Friday	2	32	1	9
21	25	Friday	2	32	2	9
22	25	Friday	4	32	5	9
23	25	Friday	4	32	6	9
24	25	Friday	5	32	5	9
25	25	Friday	5	32	6	9
\.


--
-- Data for Name: replacements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.replacements (id, absence_id, period, replacement_teacher_id, comment) FROM stdin;
147	32	1	24	
148	32	2	28	
149	33	1	27	
150	35	1	22	
151	35	2	22	
152	37	2	19	
153	37	3	16	
158	39	1	5	
159	39	2	5	
160	38	1	16	
161	38	2	16	
162	41	1	20	
163	41	2	20	
164	40	1	25	
165	40	2	25	
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rooms (id, name) FROM stdin;
1	Japan
2	Thailand
3	India
4	Singapore (Green room)
5	Vienna
6	Library
7	Beijing
8	Shanghai
9	St Petersburg
10	Manchester
11	London
12	Stockholm
13	Paris
14	New York
15	Hong Kong
16	Los Angeles
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (sid, sess, expire) FROM stdin;
rLhDIPbKKA6gH9ovOW6GJMkpiiM3pxst	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-08-10T00:20:47.656Z","secure":false,"httpOnly":true,"path":"/"},"user":{"authenticated":true}}	2026-08-10 03:21:47
eQ4ZVkP-g_e-ezTJ_JUkSJj7cNy_ncOS	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-09-07T15:04:35.024Z","secure":false,"httpOnly":true,"path":"/"},"user":{"authenticated":true}}	2026-09-09 06:10:07
L2WqBWu40UJUpaAVz0elcPORZfK72CbR	{"cookie":{"originalMaxAge":2592000000,"expires":"2026-08-10T00:31:55.833Z","secure":false,"httpOnly":true,"path":"/"},"user":{"authenticated":true}}	2026-08-10 03:32:38
\.


--
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subjects (id, name) FROM stdin;
1	Русский
2	Литература
3	Математика
4	Информатика
5	Биология
6	Химия
7	Физика
8	Естествознание
9	История
10	Обществознание
11	Экономика
12	Право
13	Иностранный Язык
14	Финансовая Грамотность
15	География
16	PE
17	Art
18	Comp Sci
19	Class hour
20	General Studies
21	History of Art
22	Digital Lit
23	EAL
24	Правовой Грамотность
25	Профориентация
26	Geography
27	Business
28	Economics
29	Sociology
30	History
31	English Language
32	Further Maths
33	Study Help
34	Philosophy
35	French
36	Russian A Level
37	PE KS5
\.


--
-- Data for Name: swap_classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.swap_classes (swap_id, class_id) FROM stdin;
2	1
2	2
4	3
4	4
5	5
5	6
6	7
6	8
7	7
7	8
10	11
11	1
11	2
12	7
12	8
16	5
16	6
17	10
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teachers (id, name) FROM stdin;
1	Sukhikh E.V.
2	Oprishko M.I.
3	Belova A.V.
4	Novikova S.G.
5	Dyachkova O.G.
6	Zakomornaya E.I.
7	Zdor E.V.
8	Seleznev A.O.
9	Varyushin A.V.
10	Vasiliyeva U.V.
11	Savinkov L.L.
12	Volkov M.M.
13	Kurenkov A.S.
14	Ustimenkova R.S.
15	Baranova A.N.
16	Mr Passmore
17	Ms Revne
18	Mr Smith
19	Mr Paterson
20	Dr Lyanchuk
21	Mr Parker
22	Mr Ribeiro
23	Ms Krasilnikova
24	Ms Balaeva
25	Mr Kolganov
26	Mr Sinkevich
27	Mr Skliar
28	Ms Alieva
29	Ms Smirnova
30	Rivkina A.
31	Ekaterina Kiyko
32	Ryzhova A.E.
33	Gredina E.N.
34	Ryazankina E.V.
35	Nikonova U.A.
\.


--
-- Name: absences_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.absences_id_seq', 41, true);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 11, true);


--
-- Name: classroom_swaps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classroom_swaps_id_seq', 17, true);


--
-- Name: curators_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.curators_id_seq', 3, true);


--
-- Name: lessons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.lessons_id_seq', 25, true);


--
-- Name: replacements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.replacements_id_seq', 165, true);


--
-- Name: rooms_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.rooms_id_seq', 16, true);


--
-- Name: subjects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_id_seq', 37, true);


--
-- Name: teachers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.teachers_id_seq', 35, true);


--
-- Name: absences absences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_pkey PRIMARY KEY (id);


--
-- Name: absences absences_teacher_id_day_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_teacher_id_day_date_key UNIQUE (teacher_id, day, date);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: classroom_swaps classroom_swaps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classroom_swaps
    ADD CONSTRAINT classroom_swaps_pkey PRIMARY KEY (id);


--
-- Name: curators curators_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.curators
    ADD CONSTRAINT curators_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_pkey PRIMARY KEY (id);


--
-- Name: lessons lessons_teacher_id_day_period_class_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_teacher_id_day_period_class_id_key UNIQUE (teacher_id, day, period, class_id);


--
-- Name: replacements replacements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.replacements
    ADD CONSTRAINT replacements_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_name_key UNIQUE (name);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: swap_classes swap_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_classes
    ADD CONSTRAINT swap_classes_pkey PRIMARY KEY (swap_id, class_id);


--
-- Name: teachers teachers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_name_key UNIQUE (name);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: absences absences_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: classes classes_curator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_curator_id_fkey FOREIGN KEY (curator_id) REFERENCES public.curators(id);


--
-- Name: classroom_swaps classroom_swaps_new_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classroom_swaps
    ADD CONSTRAINT classroom_swaps_new_room_id_fkey FOREIGN KEY (new_room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: classroom_swaps classroom_swaps_original_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classroom_swaps
    ADD CONSTRAINT classroom_swaps_original_room_id_fkey FOREIGN KEY (original_room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: classroom_swaps classroom_swaps_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classroom_swaps
    ADD CONSTRAINT classroom_swaps_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: lessons lessons_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: lessons lessons_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT lessons_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: replacements replacements_absence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.replacements
    ADD CONSTRAINT replacements_absence_id_fkey FOREIGN KEY (absence_id) REFERENCES public.absences(id) ON DELETE CASCADE;


--
-- Name: replacements replacements_replacement_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.replacements
    ADD CONSTRAINT replacements_replacement_teacher_id_fkey FOREIGN KEY (replacement_teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: swap_classes swap_classes_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_classes
    ADD CONSTRAINT swap_classes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: swap_classes swap_classes_swap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swap_classes
    ADD CONSTRAINT swap_classes_swap_id_fkey FOREIGN KEY (swap_id) REFERENCES public.classroom_swaps(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ChcmSARVOxZZiX5pPQ1MWXqfvzQT4jHQWLq6el9ZnpcexJV3txcDbqa5JPzQqXd

