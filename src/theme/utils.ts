function hashCode(str) {
    var hash = 0, i = 0, len = str.length;
    while ( i < len ) {
        hash  = ((hash << 5) - hash + str.charCodeAt(i++)) << 0;
    }
    return hash;
}

export function hashcode(str) {
    return hashCode(str) + 2147483647 + 1;
}