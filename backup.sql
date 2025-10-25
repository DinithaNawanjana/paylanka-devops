--
-- PostgreSQL database dump
--

\restrict 5lQK8uSAeebdfpg9P1wKiVvM3hvUmjXNYt8AX1TrEbzf1Xx2y7KbdQd0pJ2zuEW

-- Dumped from database version 16.10 (Debian 16.10-1.pgdg13+1)
-- Dumped by pg_dump version 16.10 (Debian 16.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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
-- Name: payments; Type: TABLE; Schema: public; Owner: paylanka
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    reference character varying(40) NOT NULL,
    amount_cents integer NOT NULL,
    currency character varying(8) DEFAULT 'LKR'::character varying NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO paylanka;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: paylanka
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO paylanka;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: paylanka
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: paylanka
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: paylanka
--

COPY public.payments (id, reference, amount_cents, currency, status, created_at) FROM stdin;
1	INV-2025-01	100000	LKR	SUCCESS	2025-10-25 15:56:26.569448
6	INV-2025-02	20000	LKR	SUCCESS	2025-10-25 16:02:06.199238
7	INV-2025-03	300000	LKR	SUCCESS	2025-10-25 16:59:36.923808
8	DEBUG-TEST-001	12345	LKR	SUCCESS	2025-10-25 16:59:59.013002
9	DEBUG-TEST-002	9999	LKR	SUCCESS	2025-10-25 17:00:10.934678
10	INV-2025-05	250000	LKR	SUCCESS	2025-10-25 17:00:31.302128
12	INV-2025-06	2100	LKR	SUCCESS	2025-10-25 17:08:28.880348
13	INV-2025-101	150000	LKR	SUCCESS	2025-10-25 17:22:21.599391
14	INV-2025-102	89000	LKR	SUCCESS	2025-10-25 17:22:21.675501
15	INV-2025-103	220000	LKR	SUCCESS	2025-10-25 17:22:21.723541
16	INV-2025-101	150000	LKR	SUCCESS	2025-10-25 17:29:07.004986
17	INV-2025-102	89000	LKR	SUCCESS	2025-10-25 17:29:07.058363
18	INV-2025-103	220000	LKR	SUCCESS	2025-10-25 17:29:07.10969
19	INV-2025-100	50000	LKR	SUCCESS	2025-10-25 18:17:28.913679
20	INV-2025-09	500	LKR	SUCCESS	2025-10-25 18:43:27.36446
21	INV-2025-025	45600	LKR	SUCCESS	2025-10-25 18:43:49.241155
22	INV-2025-068	8900	LKR	SUCCESS	2025-10-25 18:52:55.927201
24	INV-2025-069	7800	LKR	SUCCESS	2025-10-25 19:26:38.729413
\.


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: paylanka
--

SELECT pg_catalog.setval('public.payments_id_seq', 24, true);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: paylanka
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict 5lQK8uSAeebdfpg9P1wKiVvM3hvUmjXNYt8AX1TrEbzf1Xx2y7KbdQd0pJ2zuEW

