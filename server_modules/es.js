let bdfb_module = require('./bfdb_module.js');
let bfdb_common = require('./bfdb_common.js');

let ExtraSkillDB = function(){
    let options = {};
    options.name = "ES";

    let servers = ['gl', 'eu', 'jp'];
    let files = ['es'];
    let setupFn = function (db, loaded_files, server) {
        //add in anything in db_sub and not in db_main to db_main
        function merge_databases(db_main, db_sub, server) {
            let keys = Object.keys(db_sub);
            for (var es of keys) { //iterate through everything in object
                var id = es;
                if (db_main[es] !== undefined) { //exists, so just add date add time
                    if (db_main[es].server.indexOf(server) == -1) {
                        db_main[es].server.push(server);
                    }
                } else { //doesn't exist, so add it
                    db_main[id] = db_sub[es];
                    db_main[id].server = [server];
                }
                delete db_sub[es];
            }
        }
        console.log(`Loaded file for ES in ${server}. Begin processing...`);

        merge_databases(db, loaded_files.es, server);

        console.log(`Finished processing for ES in ${server}`);
    };

    options.files = bfdb_common.generateSetupFiles(files, setupFn);

    options.getByID = bfdb_common.getByID;

    options.search = (query,db) => {
        function get_query_value(queryField, es) {
            try {
                switch (queryField) {
                    case 'name_id':
                        return es.name.toLowerCase() + (es.translated_name ? (" " + es.translated_name.toLowerCase()) : "") + `(${es.id})`;
                    case 'desc': return es.desc.toLowerCase();
                    case 'effects': return JSON.stringify(es.effects);
                    case 'server': return JSON.stringify(es.server);
                    default: return "";
                }
            } catch (err) {
                // console.log(err);
                return "";
            }
        }

        function contains_query(query,es){
            var ignored_fields = ['strict', 'translate', 'verbose'];
            for (var q in query) {
                var curQuery = query[q].toString().toLowerCase();
                //wildcard queries
                if (curQuery == '' || (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
                    continue;
                }

                try {
                    var esValue = get_query_value(q, es).toString();
                    if (esValue.indexOf(curQuery) == -1) {
                        return false; //stop if any part of query is not in es
                    }
                } catch (err) { //only occurs if requested field is empty in es
                    return false;
                }
            }
            return true;
        }
        let results = [];
        for (let u in db) {
            if (contains_query(query, db[u])) {
                results.push(u);
            }
        }

        if (query.verbose === true || query.verbose == 'true') {
            console.log("Search results", results);
        }
        return results;
    };

    options.translate = {
        needsTranslation: bfdb_common.needsTranslation,
        translate: bfdb_common.defaultTranslate,
        max_translations: 5
    };

    options.downloadLimit = 3;

    options.update_statistics = (db) => { return bfdb_common.updateStatistics(db, "es"); };

    return new bdfb_module(options);
};

module.exports = new ExtraSkillDB();