alter table "graph_node"
    add "content_text_length" int 
    generated always as (char_length(content_text::text)) stored
;