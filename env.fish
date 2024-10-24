set -lx lines (cat .env.local)
for line in $lines
    if test -z "$line"; or echo $line | string match -qr '^#'
        continue
    end
    set -lx key (echo $line | cut -d '=' -f 1)
    set -lx value (echo $line | cut -d '=' -f 2-)
    #set -lx escaped_value (string replace -ar -- '([#"'\''\\$ ])' '\\$1' -- $value)
    set -lx key (echo $key | string trim)
    set -lx value (echo $value | string trim)

    set -gx $key $value
end
