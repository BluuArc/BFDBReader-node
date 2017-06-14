# Reading Buffs
## General
* The information here refers to data in the `full_buff_id.json`, `full_passive_id.json`, and `full_proc_id.json` files
* The data was gathered from the files in the file table shown below for the EU, GL, and JP servers in [the BF datamine](https://github.com/Deathmax/bravefrontier_data)

### File Table
| Name | Filename | Description |
| :---: | :---: | :---: |
| bbs | bbs.json | Brave Bursts of units and enemies |
| es | es.json | Extra Skills of units and elgifs |
| feskills | feskills.json | SP Enhancements of units |
| info | info.json | Unit data |
| items | items.json | Item data |
| ls | ls.json | Leader Skill data |

## Format
* All entries are in the following format
```
{
    "[proc|buff|passive]_id_#": {
        "buff_key_name": {
            "[bbs|es|feskills|info|items|ls]_value": {
                "1": "10011",
                "2": "10012,
                .
                .
                .
                }
    
            },
            .
            .
            .
        },
        "buff_key_name": {
            "[bbs|es|feskills|info|items|ls]_id": [
                "1000",
                "1050",
                .
                .
                .

            ],
            .
            .
            .
        },
        
        .
        .
        .
    },
    .
    .
    .
}
```

### Field Descriptions
| Field | Description | Example(s) | Notes |
| :---: | :---: | :---: | :---: |
| `[proc\|buff\|passive]_id_#` | tells which proc/buff/passive ID the current entry is | `"proc_id_1"` for proc ID 1, `"passive_id_1"` for passive ID 1 | |
| `"buff_key_name"` | tells one of the fields related to the current buff | `"bb dmg%"`, `"atk% buff"` | |
| `"[bbs\|es\|feskills\|info\|items\|ls]_value"` | tells which file the buff can be found in; see file table for explanation as to which file each thing refers to; the `_value` part tells that this field contains the unique values of the buff | `es_value` for `es.json`, `bbs_value` for `bbs.json, `feskills_value` for `feskills.json` | |
| each value of `"[bbs\|es\|feskills\|info\|items\|ls]_value"` | maps each unique value to the first ID found to hold that value | `"0.0/0": "10011"` from `info_value` maps the value *0.0/0* to the ID *10011* in the `info.json` file since it's the first unit with that value
| `"[bbs\|es\|feskills\|info\|items\|ls]_id"` | tells which file the buff can be found in; see file table for explanation as to which file each thing refers to; the `_id` part tells that this field contains an array of IDs (5 at most) | `es_id` for `es.json`, `bbs_id` for `bbs.json`, `info_id` for `info.json` | The `buff_key_names` that have this field are *"hit dmg% distribution" and "frame times"* because these values are unique per unit
| each value of `"[bbs\|es\|feskills\|info\|items\|ls]_id"` | maps to the first 5 IDs found to hold that value | `"1000"` from `bbs_id` maps to the ID *1000* in the `bbs.json` file since it's the first entry with that value


## Example
* Shown below is a small snippet of the entry `proc_id_1` in `full_proc_id.json`
```
"proc_id_1": {
    "hit dmg% distribution": {
        "bbs_id": [
            "1000",
            "1050",
            "1051",
            "1052",
            "1053"
        ],
        "info_id": [
            "10011",
            "10012",
            "10013",
            "10014",
            "10015"
        ]
    },
    "target area": {
        "bbs_value": {
            "0": "10130",
            "aoe": "1000",
            "single": "1954"
        },
        "info_value": {
            "0": "760146",
            "aoe": "10011",
            "single": "10021"
        },
        "es_value": {
            "0": "760146"
        }
    },
},
```
* From the snippet, one can observe that
    * The current entry relates to proc ID 1
    * There are two fields that can exist in proc ID 1, `hit dmg% distribution` and `target area`
    * In regards to the `hit dmg% distribution` field
        * It can only be found in `bbs.json` and `info.json` since there are no entries for any of the other file names
        * There are 5 IDs shown for the first 5 entries that have the `hit dmg% distribution` field in `bbs.json` and `info.json`
    * In regards to the `target area` field
        * It can only be found in `bbs.json`, `info.json`, and `es.json` since there are no entries for any of the other file names
        * The possible values for the `target area` field in `bbs` and `info` include *0*, *aoe*, and *single*, in which examples for each possible value can be found at the corresponding ID entries in `bbs.json` and `info.json`
        * The only possible value for the `target area` field in `es` is *0*, in which an example of that can be found in the `760146` entry in `es.json`