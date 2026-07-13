namespace Ecommerce.Application.Common;

public static class AdminDateTime
{
    private static readonly Lazy<TimeZoneInfo> BusinessTimeZoneProvider = new(ResolveBusinessTimeZone);

    public static TimeZoneInfo BusinessTimeZone => BusinessTimeZoneProvider.Value;

    public static DateTimeOffset BusinessNow => TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, BusinessTimeZone);

    public static DateTimeOffset ToUtcStartOfBusinessDay(DateOnly value)
    {
        var localDateTime = value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var offset = BusinessTimeZone.GetUtcOffset(localDateTime);
        return new DateTimeOffset(localDateTime, offset).ToUniversalTime();
    }

    public static DateTimeOffset ToUtcStartOfNextBusinessDay(DateOnly value)
    {
        var nextDay = value.AddDays(1);
        var localDateTime = nextDay.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        var offset = BusinessTimeZone.GetUtcOffset(localDateTime);
        return new DateTimeOffset(localDateTime, offset).ToUniversalTime();
    }

    public static DateOnly ToBusinessDate(DateTimeOffset value)
    {
        var localValue = TimeZoneInfo.ConvertTime(value, BusinessTimeZone);
        return DateOnly.FromDateTime(localValue.DateTime);
    }

    private static TimeZoneInfo ResolveBusinessTimeZone()
    {
        foreach (var timeZoneId in new[] { "SA Pacific Standard Time", "America/Lima" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }
}