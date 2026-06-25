
-- Reset CVM field mapping with real CVM column names (per official spec provided by user)
DELETE FROM public.cvm_fidc_field_mapping;

INSERT INTO public.cvm_fidc_field_mapping (metric_name, source_file_pattern, source_column, composite_rule, transformation, is_required, notes) VALUES
-- === TAB I ===
('total_assets',                       '_tab_i_',  'TAB_I_VL_ATIVO',                   NULL, NULL, true,  'Ativo total'),
('cash_strict_value',                  '_tab_i_',  'TAB_I1_VL_DISP',                   NULL, NULL, false, 'Disponibilidades'),
('portfolio_book_value',               '_tab_i_',  'TAB_I2_VL_CARTEIRA',               NULL, NULL, false, 'Carteira contábil'),
('credit_rights_with_risk_transfer',   '_tab_i_',  'TAB_I2A_VL_DIRCRED_RISCO',         NULL, NULL, false, 'DC com risco'),
('credit_rights_without_risk_transfer','_tab_i_',  'TAB_I2B_VL_DIRCRED_SEM_RISCO',     NULL, NULL, false, 'DC sem risco'),
('credit_rights_value',                '_tab_i_',  NULL, 'sum:TAB_I2A_VL_DIRCRED_RISCO,TAB_I2B_VL_DIRCRED_SEM_RISCO', NULL, true, 'DC total'),
('pdd_value',                          '_tab_i_',  NULL, 'abs_sum:TAB_I2A11_VL_REDUCAO_RECUP,TAB_I2B11_VL_REDUCAO_RECUP', NULL, true, 'PDD (colunas 11, não 10)'),
('cash_value',                         '_tab_i_',  NULL, 'sum:TAB_I1_VL_DISP,TAB_I2C_VL_VLMOB,TAB_I2D_VL_TITPUB_FED,TAB_I2E_VL_CDB,TAB_I2F_VL_OPER_COMPROM,TAB_I2G_VL_OUTRO_RF,TAB_I2H_VL_COTA_FIDC,TAB_I2I_VL_COTA_FIDC_NP,TAB_I2J_VL_CONTRATO_FUTURO', NULL, false, 'Caixa ampliado'),

-- === TAB III ===
('total_liabilities',                  '_tab_iii_', 'TAB_III_VL_PASSIVO',              NULL, NULL, false, 'Passivo total'),

-- === TAB IV ===
('nav_value',                          '_tab_iv_',  'TAB_IV_A_VL_PL',                  NULL, NULL, true,  'PL oficial'),
('avg_nav_value',                      '_tab_iv_',  'TAB_IV_B_VL_PL_MEDIO',            NULL, NULL, false, 'PL médio'),

-- === TAB V (com risco) ===
('tab_v_overdue_total',                '_tab_v_',   'TAB_V_B_VL_DIRCRED_INAD',         NULL, NULL, false, 'Inad. com risco total'),
('tab_v_overdue_30',                   '_tab_v_',   'TAB_V_B1_VL_INAD_30',             NULL, NULL, false, NULL),
('tab_v_overdue_60',                   '_tab_v_',   'TAB_V_B2_VL_INAD_60',             NULL, NULL, false, NULL),
('tab_v_overdue_90',                   '_tab_v_',   'TAB_V_B3_VL_INAD_90',             NULL, NULL, false, NULL),
('tab_v_overdue_120',                  '_tab_v_',   'TAB_V_B4_VL_INAD_120',            NULL, NULL, false, NULL),
('tab_v_overdue_150',                  '_tab_v_',   'TAB_V_B5_VL_INAD_150',            NULL, NULL, false, NULL),
('tab_v_overdue_180',                  '_tab_v_',   'TAB_V_B6_VL_INAD_180',            NULL, NULL, false, NULL),
('tab_v_overdue_360',                  '_tab_v_',   'TAB_V_B7_VL_INAD_360',            NULL, NULL, false, NULL),
('tab_v_overdue_720',                  '_tab_v_',   'TAB_V_B8_VL_INAD_720',            NULL, NULL, false, NULL),
('tab_v_overdue_1080',                 '_tab_v_',   'TAB_V_B9_VL_INAD_1080',           NULL, NULL, false, NULL),
('tab_v_overdue_1080p',                '_tab_v_',   'TAB_V_B10_VL_INAD_MAIOR_1080',    NULL, NULL, false, NULL),
('tab_v_prepaid_total',                '_tab_v_',   'TAB_V_C_VL_DIRCRED_ANTECIPADO',   NULL, NULL, false, NULL),

-- === TAB VI (sem risco) ===
('tab_vi_overdue_total',               '_tab_vi_',  'TAB_VI_B_VL_DIRCRED_INAD',        NULL, NULL, false, 'Inad. sem risco total'),
('tab_vi_overdue_30',                  '_tab_vi_',  'TAB_VI_B1_VL_INAD_30',            NULL, NULL, false, NULL),
('tab_vi_overdue_60',                  '_tab_vi_',  'TAB_VI_B2_VL_INAD_60',            NULL, NULL, false, NULL),
('tab_vi_overdue_90',                  '_tab_vi_',  'TAB_VI_B3_VL_INAD_90',            NULL, NULL, false, NULL),
('tab_vi_overdue_120',                 '_tab_vi_',  'TAB_VI_B4_VL_INAD_120',           NULL, NULL, false, NULL),
('tab_vi_overdue_150',                 '_tab_vi_',  'TAB_VI_B5_VL_INAD_150',           NULL, NULL, false, NULL),
('tab_vi_overdue_180',                 '_tab_vi_',  'TAB_VI_B6_VL_INAD_180',           NULL, NULL, false, NULL),
('tab_vi_overdue_360',                 '_tab_vi_',  'TAB_VI_B7_VL_INAD_360',           NULL, NULL, false, NULL),
('tab_vi_overdue_720',                 '_tab_vi_',  'TAB_VI_B8_VL_INAD_720',           NULL, NULL, false, NULL),
('tab_vi_overdue_1080',                '_tab_vi_',  'TAB_VI_B9_VL_INAD_1080',          NULL, NULL, false, NULL),
('tab_vi_overdue_1080p',               '_tab_vi_',  'TAB_VI_B10_VL_INAD_MAIOR_1080',   NULL, NULL, false, NULL),
('tab_vi_prepaid_total',               '_tab_vi_',  'TAB_VI_C_VL_DIRCRED_ANTECIPADO',  NULL, NULL, false, NULL),

-- === TAB VII ===
('acquisition_with_risk_value',        '_tab_vii_', 'TAB_VII_A1_2_VL_DIRCRED_RISCO',   NULL, NULL, false, NULL),
('acquisition_without_risk_value',     '_tab_vii_', 'TAB_VII_A2_2_VL_DIRCRED_SEM_RISCO', NULL, NULL, false, NULL),
('sale_to_assignor_value',             '_tab_vii_', 'TAB_VII_B1_2_VL_CEDENTE',         NULL, NULL, false, NULL),
('sale_to_service_provider_value',     '_tab_vii_', 'TAB_VII_B2_2_VL_PREST',           NULL, NULL, false, NULL),
('sale_to_third_party_value',          '_tab_vii_', 'TAB_VII_B3_2_VL_TERCEIRO',        NULL, NULL, false, NULL),
('substitution_value',                 '_tab_vii_', 'TAB_VII_C_2_VL_SUBST',            NULL, NULL, false, NULL),
('repurchase_value',                   '_tab_vii_', 'TAB_VII_D_2_VL_RECOMPRA',         NULL, NULL, false, 'Recompras'),

-- === TAB X_1 (cotistas por classe — somar) ===
('investors_count',                    '_tab_x_1_', 'TAB_X_NR_COTST',                  NULL, 'int', false, 'Soma de cotistas por classe/série');
