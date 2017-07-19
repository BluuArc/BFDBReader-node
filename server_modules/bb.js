let bdfb_module = require('./bfdb_module.js');
let bfdb_common = require('./bfdb_common.js');

let BraveBurstDB = function(){
    let options = {};
    options.name = "Brave Bursts";

    let servers = ['gl','eu','jp'];
    let files = ['bbs'];
    let setupFn = function (db, loaded_files, server) {
        //add in anything in db_sub and not in db_main to db_main
        function merge_databases(db_main, db_sub, server) {
            let keys = Object.keys(db_sub);
            for (var bb of keys) { //iterate through everything in object
                var id = bb;
                if (db_main[bb] !== undefined) { //exists, so just add date add time
                    if (db_main[bb].server.indexOf(server) == -1) {
                        db_main[bb].server.push(server);
                    }
                } else { //doesn't exist, so add it
                    db_main[id] = db_sub[bb];
                    db_main[id].server = [server];
                }
                delete db_sub[bb];
            }
        }
        console.log(`Loaded file for BBs in ${server}. Begin processing...`);

        merge_databases(db, loaded_files.bbs, server);

        delete loaded_files.bbs;

        console.log(`Finished processing for BBs in ${server}`);
    };

    options.files = bfdb_common.generateSetupFiles(files, setupFn);

    options.getByID = bfdb_common.getByID;

    options.search = (query, db) => {
        let verbose = query.verbose === true || query.verbose == 'true';
        function get_query_value(queryField, bb) {
            try {
                switch (queryField) {
                    case 'name_id':
                        return bb.name.toLowerCase() + (bb.translated_name ? (" " + bb.translated_name.toLowerCase()) : "") + `(${bb.id})`;
                    case 'desc': return (bb.desc || "").toLowerCase();
                    case 'effects': 
                        let endLevel = bb.levels[bb.levels.length - 1];
                        return JSON.stringify(endLevel.effects);
                    case 'server': return JSON.stringify(bb.server);
                    default: return "";
                }
            } catch (err) {
                // console.log(err);
                return "";
            }
        }

        function contains_query(query, bb) {
            var ignored_fields = ['strict', 'translate', 'verbose'];
            for (var q in query) {
                var curQuery = query[q].toString().toLowerCase();
                //wildcard queries
                if (curQuery == '' || (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
                    continue;
                }

                try {
                    var bbValue = get_query_value(q, bb).toString();
                    // console.log(q,bbValue);
                    if (bbValue.indexOf(curQuery) == -1) {
                        if(verbose)
                            console.log(q,"No match in",bbValue);
                        return false; //stop if any part of query is not in bb
                    }
                } catch (err) { //only occurs if requested field is empty in bb
                    if(verbose)
                        console.log(q,"Error",err);
                    return false;
                }
            }
            return true;
        }
        let results = [];
        for (let u in db) {
            if(verbose) console.log("Checking BB",u);
            if (contains_query(query, db[u])) {
                results.push(u);
            }
        }

        if (verbose) {
            console.log("Search results", results);
        }
        return results;
    };

    options.translate = {
        needsTranslation: bfdb_common.needsTranslation,
        translate: bfdb_common.defaultTranslate,
        max_translations: 5
    };

    options.update_statistics = (db) => { return bfdb_common.updateStatistics(db, "bbs"); };

    return new bdfb_module(options);
};

module.exports = new BraveBurstDB();