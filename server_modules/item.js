let bdfb_module = require('./bfdb_module.js');
let bfdb_common = require('./bfdb_common.js');

let ItemDB = function(){
    let options = {};
    // options.files = [];
    options.name = "Item";

    let servers = ['gl','eu','jp'];
    let files = ['items'];
    let setupFn = function(db,loaded_files,server){
        //add in anything in db_sub and not in db_main to db_main
        function merge_databases(db_main, db_sub, server) {
            let keys = Object.keys(db_sub);
            for (var item of keys) { //iterate through everything in object
                var id = item;
                if (db_main[item] !== undefined) { //exists, so just add date add time
                    if (db_main[item].server.indexOf(server) == -1) {
                        db_main[item].server.push(server);
                    }
                } else { //doesn't exist, so add it
                    db_main[id] = db_sub[item];
                    db_main[id].server = [server];
                }
                delete db_sub[item];
            }
        }
        //convert all IDs in recipes to names
        function translate_recipes(items) {
            for (let i in items) {
                let curItem = items[i];
                if (curItem.recipe !== undefined) {
                    for (let m in curItem.recipe.materials) {
                        curItem.recipe.materials[m].name = items[curItem.recipe.materials[m].id].name;
                    }
                }
            }
        }
        //create usage field for all items
        function get_item_usage(items) {
            //for every item
            for (let i in items) {
                let curItem = items[i];
                curItem.usage = [];
                //for every other item with a recipe
                for (let j in items) {
                    if (items[j].recipe !== undefined && j !== i) {
                        //for every material in the other item
                        for (let m in items[j].recipe.materials) {
                            if (items[j].recipe.materials[m].id == curItem.id) {
                                curItem.usage.push({
                                    id: j,
                                    name: items[j].name
                                });
                            }
                        }
                    }
                }
            }
        }
        console.log(`Loaded file for items in ${server}. Begin processing...`);

        merge_databases(db,loaded_files.items,server);


        if(servers.indexOf(server) === servers.length-1){
            console.log("Finished merging last file. Translating recipes and creating item usage fields");
            translate_recipes(db);
            get_item_usage(db);
        }

        console.log(`Finished processing for items in ${server}`);
    };

    options.files = bfdb_common.generateSetupFiles(files,setupFn);

    options.getByID = bfdb_common.getByID;

    options.search = (query,db) => {
        function get_item_query_value(queryField, item) {
            try {
                switch (queryField) {
                    case 'item_name_id':
                        return `${item.name.toLowerCase()}${(item.translated_name ? (" " + item.translated_name.toLowerCase()) : "")} (${item.id})`;
                    case 'item_desc': return item.desc.toLowerCase();
                    case 'rarity': return item.rarity.toString();
                    case 'type': return item.type.toLowerCase();
                    case 'effect': return JSON.stringify(item.effect);
                    case 'sphere_type': return item["sphere type text"].toLowerCase();
                    case 'recipe': return JSON.stringify(item.recipe);
                    case 'server': return JSON.stringify(item.server);
                    default: return "";
                }
            } catch (err) {
                // console.log(err);
                return "";
            }
        }
        function contains_query(query,item){
            var ignored_fields = ['strict', 'translate', 'verbose'];
            for (var q in query) {
                var curQuery = query[q].toString().toLowerCase();
                //wildcard queries
                if (curQuery == '' || (q == 'type' && curQuery == 'any') ||
                    (q == 'sphere_type' && curQuery == 'any') ||
                    (q == 'server' && curQuery == 'any') || ignored_fields.indexOf(q) > -1) {
                    continue;
                }

                try {
                    var itemValue = get_item_query_value(q, item).toString();
                    if (itemValue.indexOf(curQuery) == -1) {
                        return false; //stop if any part of query is not in item
                    }
                } catch (err) { //only occurs if requested field is empty in item
                    return false;
                }
            }
            return true;
        }
        if (query.verbose === true || query.verbose == 'true') {
            console.log("Query:", query);
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

    options.update_statistics = (db) => { return bfdb_common.updateStatistics(db, "item"); }

    return new bdfb_module(options);
};

module.exports = new ItemDB();